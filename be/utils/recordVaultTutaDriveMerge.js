/**
 * Merge notes from a plain TutaNotes vault zip into the live unlocked TutaDrive session.
 * The backup's notes index is the Postgres export at the zip root (read in memory); the live
 * vault is the member's Postgres index. New note titles are added; duplicate titles require
 * overwrite/skip (resolved in FE).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { tutaDriveMemberRoot } from './tutaDriveMemberPaths.js';
import { resolveVaultRootFromExtractedDir } from './recordVaultUsb/vaultPlainZipRestore.js';
import { openVaultBuffer } from './recordVaultUsb/vaultCrypto.js';
import { resolveVaultFileStoragePath, resolveVaultPhotoStoragePath } from './recordVaultUsb/vaultPaths.js';
import { NOTES_VAULT_TABLES as T } from './recordVaultUsb/vaultPgStore.js';
import { readTutaNotesBackupIndex } from './recordVaultTutaDriveBackup.js';
import {
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

const isLive = (row) => row?.deleted_at == null;
const byOrder = (idCol) => (x, y) =>
  (Number(x.display_order) || 0) - (Number(y.display_order) || 0) || Number(x[idCol]) - Number(y[idCol]);

/** Backup notes index (in memory) + the key that opens the backup's media files. */
async function openBackupIndex(staging) {
  const extractDir = path.join(staging.stagingRoot, 'extract');
  const sourceRoot = staging.backupVaultRoot || resolveVaultRootFromExtractedDir(extractDir);
  const { index, key } = await readTutaNotesBackupIndex(extractDir, sourceRoot);
  const tables = index.tables || {};
  const list = (name) => (Array.isArray(tables[name]) ? tables[name] : []);
  return {
    mountPath: staging.mountPath,
    key,
    notebooks: list('notebooks').filter(isLive).sort(byOrder('notebook_id')),
    notes: list('notes').filter(isLive),
    keywords: list('keywords'),
    attachments: list('attachments').filter(isLive),
    extraImages: list('extraImages').filter(isLive)
  };
}

/** Notebook → notes title tree from an extracted backup (read-only). */
export async function listTutaDriveBackupNotebookTree(staging) {
  const backupCtx = await openBackupIndex(staging);
  const notesByNotebook = new Map();
  for (const row of listBackupNotes(backupCtx)) {
    const notebookId = Number(row.notebook_id);
    if (!notesByNotebook.has(notebookId)) notesByNotebook.set(notebookId, []);
    notesByNotebook.get(notebookId).push({
      noteId: Number(row.note_id),
      noteName: String(row.note_name || '').trim() || 'Untitled'
    });
  }
  return {
    notebooks: backupCtx.notebooks.map((nb) => {
      const notebookId = Number(nb.notebook_id);
      return {
        notebookId,
        notebookName: String(nb.notebook_name || '').trim() || 'Notebook',
        notes: notesByNotebook.get(notebookId) || []
      };
    })
  };
}

/** Extract plain vault zip → notebook/note title tree → cleanup staging. */
export async function listTutaDriveBackupNotebookTreeFromZip(memberId, singlesId, zipFilePath) {
  const staging = await extractTutaDriveMergeZip(memberId, singlesId, zipFilePath);
  try {
    return await listTutaDriveBackupNotebookTree(staging);
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
  const notebookById = new Map(backupCtx.notebooks.map((nb, i) => [Number(nb.notebook_id), { nb, order: i }]));
  return backupCtx.notes
    .filter((n) => notebookById.has(Number(n.notebook_id)))
    .map((n) => ({ ...n, notebook_name: notebookById.get(Number(n.notebook_id)).nb.notebook_name }))
    .sort(
      (x, y) =>
        notebookById.get(Number(x.notebook_id)).order - notebookById.get(Number(y.notebook_id)).order ||
        byOrder('note_id')(x, y)
    );
}

async function findLiveNoteByTitle(liveSession, noteName) {
  return liveSession.db.one(
    `SELECT note_id, updated_at FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NULL AND lower(note_name) = lower($2)
      ORDER BY note_id ASC LIMIT 1`,
    [liveSession.db.singlesId, String(noteName || '').trim()]
  );
}

async function findLiveNoteIdByTitle(liveSession, noteName) {
  const row = await findLiveNoteByTitle(liveSession, noteName);
  return row ? Number(row.note_id) : null;
}

function toIsoOrNull(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function findLiveNotebookIdByName(liveSession, notebookName) {
  const row = await liveSession.db.one(
    `SELECT notebook_id FROM ${T.notebooks}
      WHERE singles_id = $1 AND deleted_at IS NULL AND lower(notebook_name) = lower($2)
      ORDER BY notebook_id ASC LIMIT 1`,
    [liveSession.db.singlesId, String(notebookName || '').trim()]
  );
  return row ? Number(row.notebook_id) : null;
}

function loadBackupNoteRow(backupCtx, noteId) {
  return backupCtx.notes.find((n) => Number(n.note_id) === Number(noteId)) || null;
}

function loadBackupKeywords(backupCtx, noteId) {
  return backupCtx.keywords
    .filter((k) => Number(k.note_id) === Number(noteId))
    .sort((x, y) => Number(x.note_keyword_id) - Number(y.note_keyword_id))
    .map((k) => k.keyword);
}

function loadBackupExtraImages(backupCtx, noteId) {
  return backupCtx.extraImages.filter((r) => Number(r.note_id) === Number(noteId)).sort(byOrder('image_id'));
}

function loadBackupAttachments(backupCtx, noteId) {
  return backupCtx.attachments.filter((r) => Number(r.note_id) === Number(noteId)).sort(byOrder('attachment_id'));
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
  const buffer = readBackupBytes(backupCtx.mountPath, backupCtx.key, relative, 'photo');
  if (!buffer?.length) return;
  const ext = String(backupNote[fields.ext] || 'jpg').replace(/^\./, '');
  const patch =
    slot === 'top'
      ? { image_topParsed: { buffer, ext } }
      : slot === 'bottom'
        ? { image_bottomParsed: { buffer, ext } }
        : { imageParsed: { buffer, ext } };
  await vaultUpdateNote(liveSession, liveNoteId, patch);
}

async function clearLiveNoteMedia(liveSession, noteId) {
  for (const slot of ['center', 'top', 'bottom']) {
    const clearKey = slot === 'top' ? 'clear_image_top' : slot === 'bottom' ? 'clear_image_bottom' : 'clear_image';
    await vaultUpdateNote(liveSession, noteId, { [clearKey]: true });
  }
  const extraRows = await liveSession.db.all(
    `SELECT image_id FROM ${T.extraImages} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [liveSession.db.singlesId, noteId]
  );
  for (const row of extraRows) {
    await vaultDeleteNoteExtraImage(liveSession, noteId, Number(row.image_id));
  }
  const attachmentRows = await liveSession.db.all(
    `SELECT attachment_id FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [liveSession.db.singlesId, noteId]
  );
  for (const row of attachmentRows) {
    await vaultDeleteNoteAttachment(liveSession, noteId, Number(row.attachment_id));
  }
}

async function copyNoteMediaAndKeywords(liveSession, backupCtx, backupNoteId, liveNoteId) {
  const backupNote = loadBackupNoteRow(backupCtx, backupNoteId);
  if (!backupNote) throw new Error('Backup note not found');

  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'center');
  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'top');
  await copySlotImage(liveSession, backupCtx, backupNote, liveNoteId, 'bottom');

  for (const img of loadBackupExtraImages(backupCtx, backupNoteId)) {
    const buffer = readBackupBytes(backupCtx.mountPath, backupCtx.key, img.relative_path, 'photo');
    if (!buffer?.length) continue;
    await vaultAddNoteExtraImage(liveSession, liveNoteId, {
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
      await liveSession.db.tx(async (tx) => {
        const orderRow = await tx.one(
          `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
             FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2`,
          [tx.singlesId, liveNoteId]
        );
        await tx.run(
          `INSERT INTO ${T.attachments}
            (singles_id, attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes,
             checksum, mime_type, display_order, shared_content_key)
           VALUES ($1, $2, $3, $4, $5, '', $6, $7, $8, $9, $10)`,
          [
            tx.singlesId,
            await tx.nextId('attachments'),
            liveNoteId,
            att.file_name || '',
            att.file_extension || '',
            Number(att.file_size_bytes) || 0,
            att.checksum || null,
            att.mime_type || null,
            Number(orderRow?.next_order ?? 0),
            sharedKey
          ]
        );
      });
      continue;
    }
    const buffer = readBackupBytes(backupCtx.mountPath, backupCtx.key, att.relative_path, 'file');
    if (!buffer?.length) continue;
    await vaultAddNoteAttachment(liveSession, liveNoteId, {
      buffer,
      fileName: att.file_name,
      ext: att.file_extension,
      mimeType: att.mime_type
    });
  }

  const keywords = loadBackupKeywords(backupCtx, backupNoteId);
  if (keywords.length) {
    await vaultUpdateNote(liveSession, liveNoteId, { keywords: keywords.join(', ') });
  }
}

async function addBackupNoteToLive(liveSession, backupCtx, backupNoteRow) {
  const backupNoteId = Number(backupNoteRow.note_id);
  const backupNote = loadBackupNoteRow(backupCtx, backupNoteId);
  if (!backupNote) throw new Error('Backup note not found');

  let notebookId = await findLiveNotebookIdByName(liveSession, backupNoteRow.notebook_name);
  if (!notebookId) {
    const created = await vaultCreateNotebook(liveSession, String(backupNoteRow.notebook_name || 'Imported'));
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

  let notebookId = await findLiveNotebookIdByName(liveSession, backupNoteRow.notebook_name);
  if (!notebookId) {
    const created = await vaultCreateNotebook(liveSession, String(backupNoteRow.notebook_name || 'Imported'));
    notebookId = Number(created.notebook_id);
  }

  await clearLiveNoteMedia(liveSession, liveNoteId);
  await vaultUpdateNote(liveSession, liveNoteId, {
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
  const backupCtx = await openBackupIndex(stagingManifest);
  const notes = [];
  for (const row of listBackupNotes(backupCtx)) {
    const noteName = String(row.note_name || '').trim();
    const live = await findLiveNoteByTitle(liveSession, noteName);
    notes.push({
      backupNoteId: Number(row.note_id),
      noteName,
      notebookName: String(row.notebook_name || '').trim(),
      conflict: Boolean(live),
      backupUpdatedAt: toIsoOrNull(row.updated_at),
      liveUpdatedAt: live ? toIsoOrNull(live.updated_at) : null
    });
  }
  return { notes };
}

export async function applyTutaDriveMerge(liveSession, stagingManifest, decisions = {}) {
  const backupCtx = await openBackupIndex(stagingManifest);
  const summary = { added: 0, overwritten: 0, skipped: 0, errors: [] };
  for (const row of listBackupNotes(backupCtx)) {
    const backupNoteId = String(Number(row.note_id));
    const noteName = String(row.note_name || '').trim();
    const liveNoteId = await findLiveNoteIdByTitle(liveSession, noteName);
    const action = decisions[backupNoteId] || (liveNoteId ? 'skip' : 'add');
    if (action === 'skip') {
      summary.skipped += 1;
      continue;
    }
    try {
      if (action === 'overwrite' && liveNoteId) {
        await overwriteLiveNoteFromBackup(liveSession, backupCtx, liveNoteId, row);
        summary.overwritten += 1;
      } else if (action === 'overwrite' || action === 'add') {
        await addBackupNoteToLive(liveSession, backupCtx, row);
        summary.added += 1;
      }
    } catch (err) {
      summary.errors.push({ noteName, message: err?.message || String(err) });
    }
  }
  return summary;
}
