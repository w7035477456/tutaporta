/**
 * TutaNotes (Record Vault) vault data in Postgres (be/db/addNotesVaultDataTables.sql).
 *
 * Each member's notes index (notebooks, notes, keywords, shortcuts, attachments, extra images)
 * lives in outdateddbsnapshotoct2024.notes_* keyed by (singles_id, local id). Media bytes stay
 * on disk under the member's vault folder. Every query goes to Primary (the shared pool) so a
 * write is visible to the next request on any web server.
 *
 * Backup zips carry the index as JSON (export / import below); the vault folder holds only
 * sealed media files and vault.meta.json.
 */
import pool from '../../db/connection.js';

const SCHEMA = 'outdateddbsnapshotoct2024';

export const NOTES_VAULT_TABLES = {
  memberVault: `${SCHEMA}.notes_member_vault`,
  notebooks: `${SCHEMA}.notes_notebooks`,
  notes: `${SCHEMA}.notes_notes`,
  keywords: `${SCHEMA}.notes_note_keywords`,
  shortcuts: `${SCHEMA}.notes_shortcuts`,
  attachments: `${SCHEMA}.notes_note_attachments`,
  extraImages: `${SCHEMA}.notes_note_extra_images`
};

const T = NOTES_VAULT_TABLES;

const ID_COLUMNS = {
  notebooks: 'notebook_id',
  notes: 'note_id',
  keywords: 'note_keyword_id',
  shortcuts: 'shortcut_id',
  attachments: 'attachment_id',
  extraImages: 'image_id'
};


const TABLE_COLUMNS = {
  notebooks: ['notebook_id', 'notebook_name', 'display_order', 'created_at', 'updated_at', 'deleted_at'],
  notes: [
    'note_id',
    'notebook_id',
    'note_name',
    'body_text',
    'image_file_name',
    'image_file_extension',
    'image_relative_path',
    'image_checksum',
    'image_file_size_bytes',
    'image_top_file_name',
    'image_top_file_extension',
    'image_top_relative_path',
    'image_top_checksum',
    'image_top_file_size_bytes',
    'image_bottom_file_name',
    'image_bottom_file_extension',
    'image_bottom_relative_path',
    'image_bottom_checksum',
    'image_bottom_file_size_bytes',
    'display_order',
    'search_text',
    'inner_encrypt_enabled',
    'inner_pin_salt',
    'inner_unlock_locked_until',
    'created_at',
    'updated_at',
    'deleted_at'
  ],
  keywords: ['note_keyword_id', 'note_id', 'keyword', 'keyword_normalized', 'created_at'],
  shortcuts: ['shortcut_id', 'target_type', 'notebook_id', 'note_id', 'display_order', 'created_at', 'updated_at'],
  attachments: [
    'attachment_id',
    'note_id',
    'file_name',
    'file_extension',
    'relative_path',
    'file_size_bytes',
    'checksum',
    'mime_type',
    'display_order',
    'shared_content_key',
    'created_at',
    'deleted_at'
  ],
  extraImages: [
    'image_id',
    'note_id',
    'file_name',
    'file_extension',
    'relative_path',
    'file_size_bytes',
    'checksum',
    'display_order',
    'created_at',
    'deleted_at'
  ]
};

/** NOT NULL columns in Postgres → value used when an imported row has NULL. */
const NOT_NULL_FALLBACKS = {
  notebook_name: '',
  note_name: '',
  body_text: '',
  search_text: '',
  display_order: 0,
  inner_encrypt_enabled: 0,
  keyword: '',
  keyword_normalized: '',
  file_name: '',
  file_extension: '',
  relative_path: '',
  file_size_bytes: 0
};

const TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at']);
const REQUIRED_TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at']);

function normalizeSinglesId(singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) throw new Error('Valid singles_id is required for the notes vault');
  return id;
}

/**
 * Member-scoped Postgres handle. Outside a transaction queries use the shared pool; inside
 * tx() they run on one client holding the member's advisory lock (serializes writes and
 * per-member id allocation across every web server).
 */
export class VaultPgDb {
  constructor(singlesId, client = null) {
    this.singlesId = normalizeSinglesId(singlesId);
    this.client = client;
  }

  async all(sql, params = []) {
    const { rows } = await (this.client || pool).query(sql, params);
    return rows;
  }

  async one(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows[0] || null;
  }

  async run(sql, params = []) {
    const result = await (this.client || pool).query(sql, params);
    return Number(result?.rowCount) || 0;
  }

  async tx(fn) {
    if (this.client) return fn(this);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `notes_vault:${this.singlesId}`
      ]);
      const result = await fn(new VaultPgDb(this.singlesId, client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Next per-member id for a table; `floor` keeps ids at or below it reserved. */
  async nextId(tableKey, { floor = 0 } = {}) {
    if (!this.client) throw new Error('VaultPgDb.nextId must run inside tx()');
    const column = ID_COLUMNS[tableKey];
    if (!column) throw new Error(`Unknown notes vault table: ${tableKey}`);
    const row = await this.one(
      `SELECT GREATEST(COALESCE(MAX(${column}), 0), $2::int) + 1 AS next_id
         FROM ${T[tableKey]}
        WHERE singles_id = $1`,
      [this.singlesId, Math.max(0, Math.trunc(Number(floor) || 0))]
    );
    return Number(row.next_id);
  }
}

export async function loadNotesMemberVault(singlesId) {
  const { rows } = await pool.query(
    `SELECT singles_id, vault_id, source, imported_from_path, created_at, updated_at
       FROM ${T.memberVault}
      WHERE singles_id = $1`,
    [normalizeSinglesId(singlesId)]
  );
  return rows[0] || null;
}

export async function hasNotesMemberVault(singlesId) {
  return Boolean(await loadNotesMemberVault(singlesId));
}

/** Removes the member's notes index (cascades to every notes_* data table). */
export async function deleteNotesMemberVault(singlesId, client = null) {
  const result = await (client || pool).query(`DELETE FROM ${T.memberVault} WHERE singles_id = $1`, [
    normalizeSinglesId(singlesId)
  ]);
  return Number(result?.rowCount) || 0;
}

/** Inside db.tx(): start an empty notes index for the member (replaces any existing one). */
export async function createNotesMemberVault(db, { vaultId = null, source = 'seed', importedFromPath = null } = {}) {
  await db.run(`DELETE FROM ${T.memberVault} WHERE singles_id = $1`, [db.singlesId]);
  await db.run(
    `INSERT INTO ${T.memberVault} (singles_id, vault_id, source, imported_from_path)
     VALUES ($1, $2, $3, $4)`,
    [db.singlesId, vaultId ? String(vaultId) : null, source, importedFromPath ? String(importedFromPath) : null]
  );
}

export async function setNotesMemberVaultId(singlesId, vaultId) {
  await pool.query(`UPDATE ${T.memberVault} SET vault_id = $2, updated_at = NOW() WHERE singles_id = $1`, [
    normalizeSinglesId(singlesId),
    vaultId ? String(vaultId) : null
  ]);
}

/* ─────────────────────────── Index export / import (backup zips) ─────────────────────────── */

export const NOTES_VAULT_INDEX_FORMAT = 'tutanotes-index';

function pgValueFromIndex(column, value) {
  if (TIMESTAMP_COLUMNS.has(column)) {
    const date = value == null || value === '' ? null : new Date(value);
    const valid = date && !Number.isNaN(date.getTime()) ? date : null;
    if (!valid && REQUIRED_TIMESTAMP_COLUMNS.has(column)) return new Date();
    return valid;
  }
  if (value == null && Object.prototype.hasOwnProperty.call(NOT_NULL_FALLBACKS, column)) {
    return NOT_NULL_FALLBACKS[column];
  }
  return value ?? null;
}

/** The member's notes index as a JSON-safe object (rows per table, ids kept). */
export async function exportNotesMemberVaultIndex(singlesId) {
  const id = normalizeSinglesId(singlesId);
  const tables = {};
  for (const [key, columns] of Object.entries(TABLE_COLUMNS)) {
    const { rows } = await pool.query(
      `SELECT ${columns.join(', ')} FROM ${T[key]} WHERE singles_id = $1 ORDER BY ${ID_COLUMNS[key]}`,
      [id]
    );
    tables[key] = rows.map((row) => {
      const out = {};
      for (const col of columns) {
        const value = row[col];
        out[col] = value instanceof Date ? value.toISOString() : value ?? null;
      }
      return out;
    });
  }
  return { format: NOTES_VAULT_INDEX_FORMAT, version: 1, exportedAt: new Date().toISOString(), tables };
}

export function isNotesVaultIndex(index) {
  return Boolean(index && index.format === NOTES_VAULT_INDEX_FORMAT && index.tables && typeof index.tables === 'object');
}

/**
 * Replace the member's notes index with an exported index (one transaction).
 * Ids are kept so on-disk file paths and note HTML stay valid.
 */
export async function importNotesMemberVaultIndex(singlesId, index, { vaultId = null, source = 'restore', importedFromPath = null } = {}) {
  if (!isNotesVaultIndex(index)) throw new Error('Backup index is missing or not a notes index');
  const db = new VaultPgDb(singlesId);
  const counts = {};
  await db.tx(async (tx) => {
    await createNotesMemberVault(tx, { vaultId, source, importedFromPath });
    for (const [key, allColumns] of Object.entries(TABLE_COLUMNS)) {
      counts[key] = 0;
      const rows = Array.isArray(index.tables[key]) ? index.tables[key] : [];
      for (const row of rows) {
        const columns = allColumns.filter((col) => Object.prototype.hasOwnProperty.call(row, col));
        if (!columns.includes(ID_COLUMNS[key])) continue;
        const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
        await tx.run(
          `INSERT INTO ${T[key]} (singles_id, ${columns.join(', ')}) VALUES ($1, ${placeholders})`,
          [tx.singlesId, ...columns.map((col) => pgValueFromIndex(col, row[col]))]
        );
        counts[key] += 1;
      }
    }
  });
  return counts;
}
