/**
 * Merge notes from a plain TutaNotes vault zip into the live unlocked TutaDrive session.
 * New note titles are added; duplicate titles require overwrite/skip (resolved in FE).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { tutaDriveMemberRoot } from './tutaDriveMemberPaths.js';
import { resolveVaultRootFromExtractedDir } from './recordVaultUsb/vaultPlainZipRestore.js';
import { openVaultBuffer } from './recordVaultUsb/vaultCrypto.js';
import { readVaultMeta } from './recordVaultUsb/usbScan.js';
import {
  isSqliteVaultDbBuffer,
  listVaultDbFileNamesForRead,
  resolveVaultDbPath,
  resolveVaultFileStoragePath,
  resolveVaultPhotoStoragePath,
  vaultRootOnMount
} from './recordVaultUsb/vaultPaths.js';
import {
  flushDbToUsb,
  vaultAddNoteAttachment,
  vaultAddNoteExtraImage,
  vaultCreateNotebook,
  vaultCreateNote,
  vaultDeleteNoteAttachment,
  vaultDeleteNoteExtraImage,
  vaultUpdateNote
} from './recordVaultUsb/vaultSession.js';
import { resolveRecordVaultSharedContentKey } from './recordVaultNewMemberSample/sharedSampleMedia.js';
import { Extract } from 'unzipper';

const MERGE_STAGING_DIR = '.merge_staging';
const MERGE_STAGING_TTL_MS = 4 * 60 * 60 * 1000;

let sqlJsPromise = null;

function getSqlJs() {
  if (!sqlJsPromise) sqlJsPromise = initSqlJs();
  return sqlJsPromise;
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  return queryAll(db, sql, params)[0] || null;
}

function tableExists(db, name) {
  const row = queryOne(db, `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [name]);
  return Boolean(row?.name);
}

function mergeStagingRoot(memberId) {
  return path.join(tutaDriveMemberRoot(memberId), MERGE_STAGING_DIR);
}

function readManifest(stagingRoot) {
  const manifestPath = path.join(stagingRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(stagingRoot, manifest) {
  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.writeFileSync(path.join(stagingRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function removeDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function purgeExpiredMergeStaging(memberId) {
  const root = mergeStagingRoot(memberId);
  if (!fs.existsSync(root)) return;
  const cutoff = Date.now() - MERGE_STAGING_TTL_MS;
  for (const name of fs.readdirSync(root)) {
    const stagingRoot = path.join(root, name);
    try {
      const manifest = readManifest(stagingRoot);
      const created = manifest?.createdAt ? Date.parse(manifest.createdAt) : fs.statSync(stagingRoot).mtimeMs;
      if (!Number.isFinite(created) || created < cutoff) removeDirRecursive(stagingRoot);
    } catch {
      removeDirRecursive(stagingRoot);
    }
  }
}

async function openBackupVaultDb(mountPath, key) {
  const vaultRoot = vaultRootOnMount(mountPath);
  const meta = readVaultMeta(mountPath);
  const candidates = [];
  const primary = resolveVaultDbPath(mountPath);
  candidates.push(primary);
  for (const name of listVaultDbFileNamesForRead(meta)) {
    const abs = path.join(vaultRoot, name);
    if (!candidates.includes(abs)) candidates.push(abs);
  }
  let openErr = null;
  for (const dbPath of candidates) {
    if (!fs.existsSync(dbPath)) continue;
    const enc = fs.readFileSync(dbPath);
    try {
      const plain = openVaultBuffer(enc, key);
      if (!isSqliteVaultDbBuffer(plain)) continue;
      const SQL = await getSqlJs();
      return { db: new SQL.Database(plain), meta, mountPath };
    } catch (err) {
      openErr = err;
    }
  }
  throw openErr || new Error('Unable to open backup vault database');
}

/** Notebook → notes title tree from an extracted backup mount (read-only). */
export async function listTutaDriveBackupNotebookTree(mountPath, key) {
  const backupCtx = await openBackupVaultDb(mountPath, key);
  try {
    const notebooks = queryAll(
      backupCtx.db,
      `SELECT notebook_id, notebook_name, display_order
       FROM notebooks
       WHERE deleted_at IS NULL
       ORDER BY display_order ASC, notebook_id ASC`
    );
    const notes = listBackupNotes(backupCtx);
    const notesByNotebook = new Map();
    for (const row of notes) {
      const notebookId = Number(row.notebook_id);
      if (!notesByNotebook.has(notebookId)) notesByNotebook.set(notebookId, []);
      notesByNotebook.get(notebookId).push({
        noteId: Number(row.note_id),
        noteName: String(row.note_name || '').trim() || 'Untitled'
      });
    }
    return {
      notebooks: notebooks.map((nb) => {
        const notebookId = Number(nb.notebook_id);
        return {
          notebookId,
          notebookName: String(nb.notebook_name || '').trim() || 'Notebook',
          notes: notesByNotebook.get(notebookId) || []
        };
      })
    };
  } finally {
    backupCtx.db.close();
  }
}

/**
 * Extract plain vault zip → notebook/note title tree → cleanup staging.
 * @param {Buffer|null} key vault AES key (env/icon); null when vault DB is plaintext
 */
export async function listTutaDriveBackupNotebookTreeFromZip(memberId, singlesId, zipFilePath, key) {
  const staging = await extractTutaDriveMergeZip(memberId, singlesId, zipFilePath);
  try {
    return await listTutaDriveBackupNotebookTree(staging.mountPath, key);
  } finally {
    cleanupTutaDriveMergeStaging(staging.stagingRoot);
  }
}

function readBackupBytes(mountPath, key, relativePath, kind = 'photo') {
  if (!relativePath) return null;
  const resolver = kind === 'file' ? resolveVaultFileStoragePath : resolveVaultPhotoStoragePath;
  const abs = resolver(mountPath, relativePath);
  if (!fs.existsSync(abs)) return null;
  try {
    return openVaultBuffer(fs.readFileSync(abs), key);
  } catch {
    return null;
  }
}

function listBackupNotes(backupCtx) {
  const { db } = backupCtx;
  return queryAll(
    db,
    `SELECT n.note_id, n.notebook_id, n.note_name, nb.notebook_name, n.display_order, nb.display_order AS notebook_order
     FROM notes n
     INNER JOIN notebooks nb ON nb.notebook_id = n.notebook_id AND nb.deleted_at IS NULL
     WHERE n.deleted_at IS NULL
     ORDER BY nb.display_order ASC, nb.notebook_id ASC, n.display_order ASC, n.note_id ASC`
  );
}

function findLiveNoteIdByTitle(liveSession, noteName) {
  const row = queryOne(
    liveSession.db,
    `SELECT note_id FROM notes WHERE deleted_at IS NULL AND lower(note_name) = lower(?) ORDER BY note_id ASC LIMIT 1`,
    [String(noteName || '').trim()]
  );
  return row ? Number(row.note_id) : null;
}

function findLiveNotebookIdByName(liveSession, notebookName) {
  const row = queryOne(
    liveSession.db,
    `SELECT notebook_id FROM notebooks WHERE deleted_at IS NULL AND lower(notebook_name) = lower(?) ORDER BY notebook_id ASC LIMIT 1`,
    [String(notebookName || '').trim()]
  );
  return row ? Number(row.notebook_id) : null;
}

function loadBackupNoteRow(backupCtx, noteId) {
  return queryOne(
    backupCtx.db,
    `SELECT * FROM notes WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
}

function loadBackupKeywords(backupCtx, noteId) {
  if (!tableExists(backupCtx.db, 'note_keywords')) return [];
  return queryAll(
    backupCtx.db,
    `SELECT keyword FROM note_keywords WHERE note_id = ? ORDER BY note_keyword_id ASC`,
    [noteId]
  ).map((row) => row.keyword);
}

function loadBackupExtraImages(backupCtx, noteId) {
  if (!tableExists(backupCtx.db, 'note_extra_images')) return [];
  return queryAll(
    backupCtx.db,
    `SELECT image_id, file_extension, relative_path, display_order
     FROM note_extra_images
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY display_order ASC, image_id ASC`,
    [noteId]
  );
}

function loadBackupAttachments(backupCtx, noteId) {
  if (!tableExists(backupCtx.db, 'note_attachments')) return [];
  return queryAll(
    backupCtx.db,
    `SELECT attachment_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type,
            display_order, shared_content_key
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY display_order ASC, attachment_id ASC`,
    [noteId]
  );
}

async function copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, slot) {
  const fields =
    slot === 'top'
      ? {
          rel: 'image_top_relative_path',
          ext: 'image_top_file_extension'
        }
      : slot === 'bottom'
        ? {
            rel: 'image_bottom_relative_path',
            ext: 'image_bottom_file_extension'
          }
        : {
            rel: 'image_relative_path',
            ext: 'image_file_extension'
          };
  const relative = backupNote[fields.rel];
  if (!relative) return;
  const buffer = readBackupBytes(backupCtx.mountPath, liveSession.key, relative, 'photo');
  if (!buffer?.length) return;
  const ext = String(backupNote[fields.ext] || 'jpg').replace(/^\./, '');
  const patch =
    slot === 'top'
      ? { image_topParsed: { buffer, ext } }
      : slot === 'bottom'
        ? { image_bottomParsed: { buffer, ext } }
        : { imageParsed: { buffer, ext } };
  vaultUpdateNote(liveSession, liveNoteId, patch);
}

async function clearLiveNoteMedia(liveSession, noteId) {
  for (const slot of ['center', 'top', 'bottom']) {
    const clearKey = slot === 'top' ? 'clear_image_top' : slot === 'bottom' ? 'clear_image_bottom' : 'clear_image';
    vaultUpdateNote(liveSession, noteId, { [clearKey]: true });
  }
  const extraRows = queryAll(
    liveSession.db,
    `SELECT image_id FROM note_extra_images WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  for (const row of extraRows) {
    vaultDeleteNoteExtraImage(liveSession, noteId, Number(row.image_id));
  }
  const attachmentRows = queryAll(
    liveSession.db,
    `SELECT attachment_id FROM note_attachments WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  for (const row of attachmentRows) {
    vaultDeleteNoteAttachment(liveSession, noteId, Number(row.attachment_id));
  }
}

async function copyNoteMediaAndKeywords(liveSession, backupCtx, backupNoteId, liveNoteId) {
  const backupNote = loadBackupNoteRow(backupCtx, backupNoteId);
  if (!backupNote) throw new Error('Backup note not found');

  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'center');
  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'top');
  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'bottom');

  for (const img of loadBackupExtraImages(backupCtx, backupNoteId)) {
    const buffer = readBackupBytes(backupCtx.mountPath, liveSession.key, img.relative_path, 'photo');
    if (!buffer?.length) continue;
    vaultAddNoteExtraImage(liveSession, liveNoteId, {
      buffer,
      ext: String(img.file_extension || 'jpg').replace(/^\./, '')
    });
  }

  for (const att of loadBackupAttachments(backupCtx, backupNoteId)) {
    const sharedKey = resolveRecordVaultSharedContentKey({
      sharedContentKey: att.shared_content_key,
      checksum: att.checksum,
      fileName: att.file_name
    });
    if (sharedKey) {
      const orderRow = queryOne(
        liveSession.db,
        `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM note_attachments WHERE note_id = ?`,
        [liveNoteId]
      );
      liveSession.db.run(
        `INSERT INTO note_attachments
          (note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type, display_order, shared_content_key)
         VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)`,
        [
          liveNoteId,
          att.file_name,
          att.file_extension,
          Number(att.file_size_bytes) || 0,
          att.checksum || null,
          att.mime_type || null,
          Number(orderRow?.next_order ?? 0),
          sharedKey
        ]
      );
      continue;
    }
    const buffer = readBackupBytes(backupCtx.mountPath, liveSession.key, att.relative_path, 'file');
    if (!buffer?.length) continue;
    vaultAddNoteAttachment(liveSession, liveNoteId, {
      buffer,
      fileName: att.file_name,
      ext: att.file_extension,
      mimeType: att.mime_type
    });
  }

  const keywords = loadBackupKeywords(backupCtx, backupNoteId);
  if (keywords.length) {
    vaultUpdateNote(liveSession, liveNoteId, { keywords: keywords.join(', ') });
  }
}

async function addBackupNoteToLive(liveSession, backupCtx, backupNoteRow) {
  const backupNoteId = Number(backupNoteRow.note_id);
  const backupNote = loadBackupNoteRow(backupCtx, backupNoteId);
  if (!backupNote) throw new Error('Backup note not found');

  let notebookId = findLiveNotebookIdByName(liveSession, backupNoteRow.notebook_name);
  if (!notebookId) {
    const created = vaultCreateNotebook(liveSession, String(backupNoteRow.notebook_name || 'Imported'));
    notebookId = Number(created.notebook_id);
  }

  const createdNote = await vaultCreateNote(liveSession, notebookId, {
    noteName: backupNote.note_name,
    bodyText: backupNote.body_text,
    innerEncryptEnabled: Number(backupNote.inner_encrypt_enabled) === 1,
    innerPinSalt: backupNote.inner_pin_salt
  });
  const liveNoteId = Number(createdNote.note_id);
  await copyNoteMediaAndKeywords(liveSession, backupCtx, backupNoteId, liveNoteId);
  return liveNoteId;
}

async function overwriteLiveNoteFromBackup(liveSession, backupCtx, liveNoteId, backupNoteRow) {
  const backupNoteId = Number(backupNoteRow.note_id);
  const backupNote = loadBackupNoteRow(backupCtx, backupNoteId);
  if (!backupNote) throw new Error('Backup note not found');

  let notebookId = findLiveNotebookIdByName(liveSession, backupNoteRow.notebook_name);
  if (!notebookId) {
    const created = vaultCreateNotebook(liveSession, String(backupNoteRow.notebook_name || 'Imported'));
    notebookId = Number(created.notebook_id);
  }

  await clearLiveNoteMedia(liveSession, liveNoteId);
  vaultUpdateNote(liveSession, liveNoteId, {
    notebook_id: notebookId,
    note_name: backupNote.note_name,
    body_text: backupNote.body_text,
    inner_encrypt_enabled: Number(backupNote.inner_encrypt_enabled) === 1,
    inner_pin_salt: backupNote.inner_pin_salt,
    inner_unlock_locked_until: backupNote.inner_unlock_locked_until
  });
  await copyNoteMediaAndKeywords(liveSession, backupCtx, backupNoteId, liveNoteId);
  return liveNoteId;
}

export async function extractTutaDriveMergeZip(memberId, singlesId, zipFilePath) {
  purgeExpiredMergeStaging(memberId);
  const mergeId = crypto.randomUUID();
  const stagingRoot = path.join(mergeStagingRoot(memberId), mergeId);
  const extractDir = path.join(stagingRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  await fs.createReadStream(zipFilePath).pipe(Extract({ path: extractDir })).promise();
  const backupVaultRoot = resolveVaultRootFromExtractedDir(extractDir);
  const mountPath = path.dirname(backupVaultRoot);
  writeManifest(stagingRoot, {
    mergeId,
    memberId,
    singlesId: Number(singlesId),
    mountPath,
    backupVaultRoot,
    createdAt: new Date().toISOString()
  });
  return { mergeId, stagingRoot, mountPath, backupVaultRoot };
}

export function loadTutaDriveMergeStaging(memberId, mergeId, singlesId) {
  const stagingRoot = path.join(mergeStagingRoot(memberId), String(mergeId || '').trim());
  const manifest = readManifest(stagingRoot);
  if (!manifest) throw new Error('Merge session not found or expired');
  if (Number(manifest.singlesId) !== Number(singlesId)) throw new Error('Merge session does not belong to this account');
  if (String(manifest.memberId) !== String(memberId)) throw new Error('Merge session member mismatch');
  if (!fs.existsSync(manifest.mountPath)) throw new Error('Merge staging files are missing');
  return { stagingRoot, ...manifest };
}

export function cleanupTutaDriveMergeStaging(stagingRoot) {
  removeDirRecursive(stagingRoot);
}

export async function previewTutaDriveMerge(liveSession, stagingManifest) {
  const backupCtx = await openBackupVaultDb(stagingManifest.mountPath, liveSession.key);
  try {
    const notes = listBackupNotes(backupCtx).map((row) => {
      const noteName = String(row.note_name || '').trim();
      const conflict = Boolean(findLiveNoteIdByTitle(liveSession, noteName));
      return {
        backupNoteId: Number(row.note_id),
        noteName,
        notebookName: String(row.notebook_name || '').trim(),
        conflict
      };
    });
    return { notes };
  } finally {
    backupCtx.db.close();
  }
}

export async function applyTutaDriveMerge(liveSession, stagingManifest, decisions = {}) {
  const backupCtx = await openBackupVaultDb(stagingManifest.mountPath, liveSession.key);
  const summary = { added: 0, overwritten: 0, skipped: 0, errors: [] };
  try {
    const notes = listBackupNotes(backupCtx);
    for (const row of notes) {
      const backupNoteId = String(Number(row.note_id));
      const noteName = String(row.note_name || '').trim();
      const conflict = Boolean(findLiveNoteIdByTitle(liveSession, noteName));
      const action = decisions[backupNoteId] || (conflict ? 'skip' : 'add');
      if (action === 'skip') {
        summary.skipped += 1;
        continue;
      }
      try {
        if (action === 'overwrite') {
          const liveNoteId = findLiveNoteIdByTitle(liveSession, noteName);
          if (!liveNoteId) {
            await addBackupNoteToLive(liveSession, backupCtx, row);
            summary.added += 1;
          } else {
            await overwriteLiveNoteFromBackup(liveSession, backupCtx, liveNoteId, row);
            summary.overwritten += 1;
          }
        } else if (action === 'add') {
          await addBackupNoteToLive(liveSession, backupCtx, row);
          summary.added += 1;
        }
      } catch (err) {
        summary.errors.push({ noteName, message: err?.message || String(err) });
      }
    }
    flushDbToUsb(liveSession);
    return summary;
  } finally {
    backupCtx.db.close();
  }
}
