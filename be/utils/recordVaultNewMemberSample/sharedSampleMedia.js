import fs from 'fs';
import path from 'path';

import { vaultFileStoragePath } from '../recordVaultUsb/vaultPaths.js';
import {
  listRecordVaultSampleAttachmentDefs,
  loadRecordVaultNewMemberSampleManifest,
  recordVaultSampleMediaPath
} from './sampleManifest.js';

const SHARED_KEY_BY_CHECKSUM = new Map();
const SHARED_DEF_BY_KEY = new Map();

function rebuildIndexes() {
  SHARED_KEY_BY_CHECKSUM.clear();
  SHARED_DEF_BY_KEY.clear();
  for (const att of listRecordVaultSampleAttachmentDefs()) {
    const key = String(att.sharedKey || '').trim();
    if (!key) continue;
    SHARED_DEF_BY_KEY.set(key, att);
    const checksum = String(att.checksum || '')
      .trim()
      .toLowerCase();
    if (checksum) SHARED_KEY_BY_CHECKSUM.set(checksum, key);
  }
}

rebuildIndexes();

export function isRecordVaultSharedSampleContentKey(sharedKey) {
  const key = String(sharedKey || '').trim();
  if (!key) return false;
  if (!SHARED_DEF_BY_KEY.size) rebuildIndexes();
  return SHARED_DEF_BY_KEY.has(key);
}

export function resolveRecordVaultSharedContentKey({ sharedContentKey, checksum, fileName } = {}) {
  const direct = String(sharedContentKey || '').trim();
  if (direct && isRecordVaultSharedSampleContentKey(direct)) return direct;
  const sum = String(checksum || '')
    .trim()
    .toLowerCase();
  if (sum && SHARED_KEY_BY_CHECKSUM.has(sum)) return SHARED_KEY_BY_CHECKSUM.get(sum);
  const name = String(fileName || '')
    .trim()
    .toLowerCase();
  if (name) {
    for (const att of listRecordVaultSampleAttachmentDefs()) {
      if (String(att.fileName || '').toLowerCase() === name) return String(att.sharedKey || '').trim();
    }
  }
  return null;
}

export function readRecordVaultSharedSampleBuffer(sharedKey) {
  const key = String(sharedKey || '').trim();
  if (!key) return null;
  if (!SHARED_DEF_BY_KEY.size) rebuildIndexes();
  const def = SHARED_DEF_BY_KEY.get(key);
  if (!def) return null;
  const abs = recordVaultSampleMediaPath(def.sourceFile || def.fileName);
  if (!abs || !fs.existsSync(abs)) return null;
  try {
    return fs.readFileSync(abs);
  } catch {
    return null;
  }
}

/**
 * Shared sample bytes are always plaintext on disk (one copy for all members).
 * Never pass through vault decrypt — user vault keys do not wrap these files.
 */
export function readRecordVaultSharedSampleForAttachmentRow(row) {
  const key = resolveRecordVaultSharedContentKey({
    sharedContentKey: row?.shared_content_key,
    checksum: row?.checksum,
    fileName: row?.file_name
  });
  if (!key) return null;
  return readRecordVaultSharedSampleBuffer(key);
}

function linkFile(targetAbs, linkAbs) {
  fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
  if (fs.existsSync(linkAbs)) return true;
  try {
    fs.symlinkSync(path.resolve(targetAbs), linkAbs, 'file');
    return true;
  } catch {
    return false;
  }
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

/**
 * Optional plaintext vault convenience: symlink View TutaDrive paths at shared media.
 * Encrypted vaults skip materialization — reads use shared store via shared_content_key.
 */
export function linkRecordVaultSharedSamplesIntoVault({ mountPath, key, meta, db }) {
  const usePlainFiles = key == null;
  if (!usePlainFiles) return false;

  const hasSharedCol = queryAll(db, `PRAGMA table_info(note_attachments)`).some(
    (row) => String(row.name || '') === 'shared_content_key'
  );
  if (!hasSharedCol) return false;

  const rows = queryAll(
    db,
    `SELECT attachment_id, relative_path, shared_content_key, checksum, file_name
     FROM note_attachments
     WHERE deleted_at IS NULL AND shared_content_key IS NOT NULL AND TRIM(shared_content_key) != ''`
  );
  let linked = 0;
  for (const row of rows) {
    const keyName = resolveRecordVaultSharedContentKey({
      sharedContentKey: row.shared_content_key,
      checksum: row.checksum,
      fileName: row.file_name
    });
    if (!keyName) continue;
    const def = SHARED_DEF_BY_KEY.get(keyName);
    const sharedAbs = recordVaultSampleMediaPath(def?.sourceFile || def?.fileName);
    if (!sharedAbs || !fs.existsSync(sharedAbs)) continue;
    const rel = String(row.relative_path || '').trim();
    if (!rel) continue;
    const vaultAbs = vaultFileStoragePath(mountPath, rel, meta);
    if (linkFile(sharedAbs, vaultAbs)) linked += 1;
  }
  return linked > 0;
}

export function recordVaultNewMemberSampleSeedMarker() {
  return String(loadRecordVaultNewMemberSampleManifest().seedMarker || 'rv-new-member-sample-v1');
}
