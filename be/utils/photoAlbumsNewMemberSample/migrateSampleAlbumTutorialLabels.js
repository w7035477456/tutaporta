import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { expandPhotoAlbumsBodyTextForSearch } from '../photoAlbumsSearch.js';
import { vaultMetaUsesPlaintextStorage } from '../photoAlbumsIconEncryption.js';
import { openVaultBuffer, sealVaultBuffer } from '../photoAlbumsUsb/vaultCrypto.js';
import {
  atomicWriteFileSync,
  isSqliteVaultDbBuffer,
  resolveVaultDbPath,
  vaultDbPath,
  vaultRootOnMount
} from '../photoAlbumsUsb/vaultPaths.js';
import { readVaultMeta } from '../photoAlbumsUsb/usbScan.js';
import { DEFAULT_SAMPLE_ALBUM_NAME, VAULT_SCHEMA_SQL } from '../photoAlbumsUsb/vaultSchema.js';
import {
  loadInitializeSampleManifest,
  loadSampleAlbumBodyHtml
} from './initializeSampleManifest.js';

/** Matches vaultSession NOTE_INNER_ENCRYPT_BODY_PREFIX — avoid circular import. */
const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

const SAMPLE_TUTORIAL_LABEL_MARKER = 'tl_sample_hint_edit_1';

let sqlJsPromise = null;

function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function attachmentsMatchBundledSample(db, noteId, manifest) {
  const expected = Array.isArray(manifest?.attachments) ? manifest.attachments : [];
  if (expected.length === 0) return false;

  const rows = queryAll(
    db,
    `SELECT attachment_id, file_name, checksum
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY attachment_id ASC`,
    [noteId]
  );
  if (rows.length !== expected.length) return false;

  for (const exp of expected) {
    const row = rows.find((r) => Number(r.attachment_id) === Number(exp.attachmentId));
    if (!row) return false;
    if (String(row.file_name || '') !== String(exp.fileName || '')) return false;
    const rowChecksum = String(row.checksum || '').trim().toLowerCase();
    const expChecksum = String(exp.checksum || '').trim().toLowerCase();
    if (rowChecksum !== expChecksum) return false;
  }
  return true;
}

function refreshSampleAlbumSearchText(db, noteId, albumName, bodyHtml) {
  const kwRows = queryAll(
    db,
    `SELECT keyword FROM note_keywords WHERE note_id = ? ORDER BY keyword_normalized ASC`,
    [noteId]
  );
  const attRows = queryAll(
    db,
    `SELECT file_name FROM note_attachments WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  const bodyForSearch = expandPhotoAlbumsBodyTextForSearch(bodyHtml);
  const searchText = [albumName, bodyForSearch, ...kwRows.map((r) => r.keyword), ...attRows.map((r) => r.file_name)]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  db.run(`UPDATE notes SET search_text = ?, updated_at = datetime('now') WHERE note_id = ?`, [
    searchText,
    noteId
  ]);
}

/**
 * Replace SAMPLE ALBUM body with bundled tutorial labels when the note still
 * uses the original seven bundled attachments. Safe no-op when labels exist
 * or the album was customized.
 *
 * @returns {{ migrated: boolean, reason?: string, noteId?: number }}
 */
export function migrateSampleAlbumTutorialLabelsDb(db) {
  const manifest = loadInitializeSampleManifest();
  const albumName = manifest.albumName || DEFAULT_SAMPLE_ALBUM_NAME;

  const note = queryOne(
    db,
    `SELECT note_id, body_text, inner_encrypt_enabled
     FROM notes
     WHERE note_name = ? AND deleted_at IS NULL
     ORDER BY note_id ASC
     LIMIT 1`,
    [albumName]
  );
  if (!note) {
    return { migrated: false, reason: 'no_sample_album' };
  }

  const noteId = Number(note.note_id);
  const innerEncrypted =
    Number(note.inner_encrypt_enabled) === 1 ||
    String(note.body_text || '').startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
  if (innerEncrypted) {
    return { migrated: false, reason: 'inner_encrypted', noteId };
  }

  if (!attachmentsMatchBundledSample(db, noteId, manifest)) {
    return { migrated: false, reason: 'not_bundled_sample', noteId };
  }

  const body = String(note.body_text || '');
  if (body.includes(SAMPLE_TUTORIAL_LABEL_MARKER)) {
    return { migrated: false, reason: 'already_migrated', noteId };
  }

  const bodyHtml = loadSampleAlbumBodyHtml();
  db.run(`UPDATE notes SET body_text = ?, updated_at = datetime('now') WHERE note_id = ?`, [
    bodyHtml,
    noteId
  ]);
  refreshSampleAlbumSearchText(db, noteId, albumName, bodyHtml);
  return { migrated: true, noteId };
}

async function openDbFromBuffer(buffer) {
  const SQL = await getSqlJs();
  const db = new SQL.Database(buffer);
  db.exec(VAULT_SCHEMA_SQL);
  return db;
}

/**
 * Open a on-disk Photo Albums vault for offline migration (plaintext only).
 *
 * @returns {Promise<{ db: import('sql.js').Database, meta: object, key: null } | { skipped: true, reason: string }>}
 */
export async function openPhotoAlbumsVaultDbForMigration(mountPath) {
  if (!mountPath || !fs.existsSync(mountPath)) {
    return { skipped: true, reason: 'missing_mount' };
  }

  const meta = readVaultMeta(mountPath) || {};
  const vaultRoot = vaultRootOnMount(mountPath);
  const encPath = path.join(vaultRoot, 'vault.db.enc');
  const hasEncryptedDbFile = fs.existsSync(encPath);
  const metaSaysPlaintext = vaultMetaUsesPlaintextStorage(meta);

  if (!metaSaysPlaintext && hasEncryptedDbFile) {
    return { skipped: true, reason: 'encrypted_vault' };
  }

  const dbPath = resolveVaultDbPath(mountPath);
  if (!fs.existsSync(dbPath)) {
    return { skipped: true, reason: 'missing_db' };
  }

  const enc = fs.readFileSync(dbPath);
  const plain = openVaultBuffer(enc, null);
  if (!isSqliteVaultDbBuffer(plain)) {
    return { skipped: true, reason: 'unreadable_db' };
  }

  const db = await openDbFromBuffer(plain);
  return { db, meta, key: null };
}

/** Persist in-memory vault DB after offline migration. */
export function persistPhotoAlbumsVaultDb(db, mountPath, meta, key = null) {
  const plain = Buffer.from(db.export());
  if (!isSqliteVaultDbBuffer(plain)) {
    throw new Error('Vault database export is not valid SQLite — aborting save');
  }
  const sealed = sealVaultBuffer(plain, key);
  atomicWriteFileSync(vaultDbPath(mountPath, meta), sealed);
}

/** @param {import('sql.js').Database} db */
export function closePhotoAlbumsVaultDb(db) {
  try {
    db?.close?.();
  } catch {
    // ignore
  }
}
