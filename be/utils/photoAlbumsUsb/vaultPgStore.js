/**
 * TutaPhotoAlbums vault data in Postgres (be/db/addPhotoAlbumsVaultDataTables.sql).
 *
 * Each member's album index (sets, albums, keywords, shortcuts, attachments, extra images) lives in
 * outdateddbsnapshotoct2024.photo_albums_* keyed by (singles_id, local id). Media bytes stay on disk
 * under the member's vault folder. Every query goes to Primary (the shared pool) so a write is
 * visible to the next request on any web server.
 *
 * Also converts between Postgres and the legacy SQLite vault.db format: import on first unlock of
 * a pre-Postgres vault, export for backup zips.
 */
import initSqlJs from 'sql.js';
import pool from '../../db/connection.js';
import { NOTE_EXTRA_IMAGES_MIGRATION_SQL, VAULT_SCHEMA_SQL } from './vaultSchema.js';

const SCHEMA = 'outdateddbsnapshotoct2024';

export const PHOTO_ALBUMS_VAULT_TABLES = {
  memberVault: `${SCHEMA}.photo_albums_member_vault`,
  notebooks: `${SCHEMA}.photo_albums_notebooks`,
  notes: `${SCHEMA}.photo_albums_notes`,
  keywords: `${SCHEMA}.photo_albums_note_keywords`,
  shortcuts: `${SCHEMA}.photo_albums_shortcuts`,
  attachments: `${SCHEMA}.photo_albums_note_attachments`,
  extraImages: `${SCHEMA}.photo_albums_note_extra_images`
};

const T = PHOTO_ALBUMS_VAULT_TABLES;

const ID_COLUMNS = {
  notebooks: 'notebook_id',
  notes: 'note_id',
  keywords: 'note_keyword_id',
  shortcuts: 'shortcut_id',
  attachments: 'attachment_id',
  extraImages: 'image_id'
};

/** Key in PHOTO_ALBUMS_VAULT_TABLES → SQLite table name in a legacy vault.db. */
const SQLITE_TABLES = {
  notebooks: 'notebooks',
  notes: 'notes',
  keywords: 'note_keywords',
  shortcuts: 'shortcuts',
  attachments: 'note_attachments',
  extraImages: 'note_extra_images'
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
    'album_photo_seq',
    'source_taken_at_ms',
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

/** NOT NULL columns in Postgres → value used when the SQLite row has NULL. */
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
  if (!Number.isFinite(id) || id < 1) throw new Error('Valid singles_id is required for the photo album vault');
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
        `photo_albums_vault:${this.singlesId}`
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
    if (!column) throw new Error(`Unknown photo album vault table: ${tableKey}`);
    const row = await this.one(
      `SELECT GREATEST(COALESCE(MAX(${column}), 0), $2::int) + 1 AS next_id
         FROM ${T[tableKey]}
        WHERE singles_id = $1`,
      [this.singlesId, Math.max(0, Math.trunc(Number(floor) || 0))]
    );
    return Number(row.next_id);
  }
}

export async function loadPhotoAlbumsMemberVault(singlesId) {
  const { rows } = await pool.query(
    `SELECT singles_id, vault_id, source, imported_from_path, created_at, updated_at
       FROM ${T.memberVault}
      WHERE singles_id = $1`,
    [normalizeSinglesId(singlesId)]
  );
  return rows[0] || null;
}

export async function hasPhotoAlbumsMemberVault(singlesId) {
  return Boolean(await loadPhotoAlbumsMemberVault(singlesId));
}

/** Removes the member's album index (cascades to every photo_albums_* data table). */
export async function deletePhotoAlbumsMemberVault(singlesId, client = null) {
  const result = await (client || pool).query(`DELETE FROM ${T.memberVault} WHERE singles_id = $1`, [
    normalizeSinglesId(singlesId)
  ]);
  return Number(result?.rowCount) || 0;
}

/** Inside db.tx(): start an empty album index for the member (replaces any existing one). */
export async function createPhotoAlbumsMemberVault(db, { vaultId = null, source = 'seed', importedFromPath = null } = {}) {
  await db.run(`DELETE FROM ${T.memberVault} WHERE singles_id = $1`, [db.singlesId]);
  await db.run(
    `INSERT INTO ${T.memberVault} (singles_id, vault_id, source, imported_from_path)
     VALUES ($1, $2, $3, $4)`,
    [db.singlesId, vaultId ? String(vaultId) : null, source, importedFromPath ? String(importedFromPath) : null]
  );
}

export async function setPhotoAlbumsMemberVaultId(singlesId, vaultId) {
  await pool.query(`UPDATE ${T.memberVault} SET vault_id = $2, updated_at = NOW() WHERE singles_id = $1`, [
    normalizeSinglesId(singlesId),
    vaultId ? String(vaultId) : null
  ]);
}

/* ─────────────────────────── SQLite vault.db ⇄ Postgres ─────────────────────────── */

let sqlJsPromise = null;

function getSqlJs() {
  if (!sqlJsPromise) sqlJsPromise = initSqlJs();
  return sqlJsPromise;
}

function sqliteAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function sqliteColumns(db, table) {
  return new Set(sqliteAll(db, `PRAGMA table_info(${table})`).map((row) => String(row.name || '')));
}

function sqliteTableExists(db, table) {
  return sqliteAll(db, `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]).length > 0;
}

/** vault.db stores UTC as 'YYYY-MM-DD HH:MM:SS'. */
function sqliteTimestampToDate(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToSqliteTimestamp(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function pgValueFromSqlite(column, value) {
  if (TIMESTAMP_COLUMNS.has(column)) {
    const date = sqliteTimestampToDate(value);
    if (!date && REQUIRED_TIMESTAMP_COLUMNS.has(column)) return new Date();
    return date;
  }
  if (value == null && Object.prototype.hasOwnProperty.call(NOT_NULL_FALLBACKS, column)) {
    return NOT_NULL_FALLBACKS[column];
  }
  return value ?? null;
}

/**
 * Replace the member's album index with the rows of a legacy SQLite vault (sql.js Database).
 * Runs in one transaction; ids are kept so on-disk file paths and page HTML stay valid.
 */
export async function importSqliteVaultIntoPostgres(singlesId, sqliteDb, { vaultId = null, source = 'import', importedFromPath = null } = {}) {
  const db = new VaultPgDb(singlesId);
  const counts = {};
  await db.tx(async (tx) => {
    await createPhotoAlbumsMemberVault(tx, { vaultId, source, importedFromPath });
    for (const [key, sqliteTable] of Object.entries(SQLITE_TABLES)) {
      counts[key] = 0;
      if (!sqliteTableExists(sqliteDb, sqliteTable)) continue;
      const available = sqliteColumns(sqliteDb, sqliteTable);
      const columns = TABLE_COLUMNS[key].filter((col) => available.has(col));
      if (!columns.includes(ID_COLUMNS[key])) continue;
      const rows = sqliteAll(sqliteDb, `SELECT ${columns.join(', ')} FROM ${sqliteTable}`);
      const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
      for (const row of rows) {
        await tx.run(
          `INSERT INTO ${T[key]} (singles_id, ${columns.join(', ')}) VALUES ($1, ${placeholders})`,
          [tx.singlesId, ...columns.map((col) => pgValueFromSqlite(col, row[col]))]
        );
        counts[key] += 1;
      }
    }
  });
  return counts;
}

/** sql.js Database from a legacy vault.db buffer, with every column the importer reads. */
export async function openLegacySqliteVaultBuffer(plainBuffer) {
  const SQL = await getSqlJs();
  const db = new SQL.Database(plainBuffer);
  db.exec(VAULT_SCHEMA_SQL);
  if (!sqliteTableExists(db, 'note_extra_images')) db.exec(NOTE_EXTRA_IMAGES_MIGRATION_SQL);
  const noteCols = sqliteColumns(db, 'notes');
  for (const [col, ddl] of [
    ['inner_encrypt_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['inner_pin_salt', 'TEXT'],
    ['inner_unlock_locked_until', 'TEXT']
  ]) {
    if (!noteCols.has(col)) db.run(`ALTER TABLE notes ADD COLUMN ${col} ${ddl}`);
  }
  const attCols = sqliteColumns(db, 'note_attachments');
  for (const col of ['album_photo_seq', 'source_taken_at_ms']) {
    if (!attCols.has(col)) db.run(`ALTER TABLE note_attachments ADD COLUMN ${col} INTEGER`);
  }
  return db;
}

/** The member's album index as a plain SQLite vault.db buffer (backup zips keep the old format). */
export async function exportPhotoAlbumsMemberVaultToSqliteBuffer(singlesId) {
  const id = normalizeSinglesId(singlesId);
  const SQL = await getSqlJs();
  const sqliteDb = new SQL.Database();
  try {
    sqliteDb.exec(VAULT_SCHEMA_SQL);
    for (const [key, sqliteTable] of Object.entries(SQLITE_TABLES)) {
      const columns = TABLE_COLUMNS[key];
      const { rows } = await pool.query(
        `SELECT ${columns.join(', ')} FROM ${T[key]} WHERE singles_id = $1 ORDER BY ${ID_COLUMNS[key]}`,
        [id]
      );
      const placeholders = columns.map(() => '?').join(', ');
      for (const row of rows) {
        sqliteDb.run(
          `INSERT INTO ${sqliteTable} (${columns.join(', ')}) VALUES (${placeholders})`,
          columns.map((col) => {
            const value = row[col];
            if (TIMESTAMP_COLUMNS.has(col)) return dateToSqliteTimestamp(value);
            if (typeof value === 'string' && /_bytes$|_ms$/.test(col)) return Number(value);
            return value ?? null;
          })
        );
      }
    }
    return Buffer.from(sqliteDb.export());
  } finally {
    sqliteDb.close();
  }
}
