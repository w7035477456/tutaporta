import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  sealVaultBuffer,
  openVaultBuffer,
  isPlaintextVaultKey,
  isVaultPhotoAndDbEncryptionEnabled
} from './vaultCrypto.js';
import {
  createIconVaultKeyMaterial,
  iconVaultKdfMetaFields,
  listIconVaultUnlockKeys,
  vaultMetaUsesArgon2idKdf
} from '../recordVaultIconKeys.js';
import { isVaultBackupUsbEnabled } from '../recordVaultStorageFlags.js';
import { buildVaultFolderListing } from '../vaultFolderTreeListing.js';
import { vaultMetaUsesPlaintextStorage } from '../recordVaultIconEncryption.js';
import {
  fileRelativePath,
  extraPhotoRelativePath,
  photoRelativePath,
  vaultFileStoragePath,
  vaultFilesRoot,
  vaultMetaPath,
  vaultPhotoStoragePath,
  vaultPhotosRoot,
  vaultRootOnMount,
  listVaultDbFileNamesForRead,
  isSqliteVaultDbBuffer,
  atomicWriteFileSync,
  resolveVaultDbPath,
  resolveVaultPhotoStoragePath,
  VAULT_DB_FILE_ENCRYPTED,
  resolveVaultFileStoragePath,
  VAULT_FILES_DIR,
  VAULT_PHOTOS_DIR,
  VAULT_META_FILE,
  ensureVaultLayoutDirs
} from './vaultPaths.js';
import { readVaultMeta, validateVaultOnMount, resolveVolumeRootMountPath } from './usbScan.js';
import {
  assertUnlockNotLocked,
  clearUnlockGuard,
  recordFailedUnlockAttempt
} from './unlockGuard.js';
import { DEFAULT_BODY_TEXT } from './vaultSchema.js';
import {
  NOTES_VAULT_TABLES as T,
  VaultPgDb,
  createNotesMemberVault,
  deleteNotesMemberVault,
  importSqliteVaultIntoPostgres,
  loadNotesMemberVault,
  openLegacySqliteVaultBuffer,
  setNotesMemberVaultId
} from './vaultPgStore.js';
import {
  ensureRecordVaultNewMemberSampleDb,
  seedRecordVaultNewMemberSampleDb,
  seedRecordVaultNewMemberSampleMedia
} from '../recordVaultNewMemberSample/seedRecordVaultNewMemberSample.js';
import {
  readRecordVaultSharedSampleForAttachmentRow,
  resolveRecordVaultSharedContentKey
} from '../recordVaultNewMemberSample/sharedSampleMedia.js';
import { applyTutaNotesTemplate } from '../recordVaultTutaNotesTemplate/applyTutaNotesTemplate.js';
import { tutaNotesTemplateZipAvailable } from '../recordVaultTutaNotesTemplate/templatePaths.js';
import {
  expandRecordVaultBodyTextForSearch,
  normalizeRecordVaultKeyword,
  noteMatchesRecordVaultSearchTerm
} from '../recordVaultSearch.js';
import { requireVaultAccessSession } from '../recordVaultAccessPassword.js';
import { mimeTypeForRecordVaultExtension } from '../recordVaultFileFormats.js';
import {
  registerVaultClusterUnlock,
  clearVaultClusterUnlock,
  getVaultClusterUnlock,
  isVaultMountPathPresent
} from '../recordVaultClusterSession.js';
import { readRecordVaultCacheIcon } from '../recordVaultCacheIcon.js';
import { flushVaultTransferBytes } from '../vaultTransferTracking.js';
import {
  addVaultSessionFileCounts,
  countVaultSessionNotebooksAndNotes,
  resetVaultSessionFileCounts,
  snapshotVaultSessionFileCountsToLast
} from '../vaultSessionFileCounts.js';
import { rvCloudWarn } from '../recordVaultCloudDebugLog.js';
import {
  bodyHasInlineDataImage,
  rewriteInlineDataImages
} from './extractInlineDataImages.js';
import { isUnchangedNoteTextPatch } from './unchangedNoteTextPatch.js';
import { markVaultSessionClusterState } from '../vaultClusterCoherence.js';

/** vault.meta.json — samples seeded once; hard-delete must not recreate them. */
export const NEW_MEMBER_SAMPLE_SEEDED_META_KEY = 'newMemberSampleSeeded';

function readNewMemberSampleSeededStamp(mountPath) {
  try {
    const meta = readVaultMeta(mountPath) || {};
    if (meta[NEW_MEMBER_SAMPLE_SEEDED_META_KEY]) return true;
    if (String(meta.tutaNotesTemplateVersion || '').trim()) return true;
  } catch {
    // ignore
  }
  return false;
}

function stampNewMemberSampleSeeded(mountPath) {
  try {
    const metaPath = vaultMetaPath(mountPath);
    let meta = {};
    try {
      meta = readVaultMeta(mountPath) || {};
    } catch {
      meta = {};
    }
    if (meta[NEW_MEMBER_SAMPLE_SEEDED_META_KEY]) return;
    meta[NEW_MEMBER_SAMPLE_SEEDED_META_KEY] = true;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.warn('[recordVault] could not stamp newMemberSampleSeeded:', err?.message || err);
  }
}


/** Prefix for FE inner-layer ciphertext stored in notes.body_text (Argon2id + AES-256-GCM). */
export const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

/** @type {Map<string, VaultSession>} */
const sessionsByKey = new Map();

export const RECORD_VAULT_STORAGE_HEADER = 'x-record-vault-storage';

export function normalizeVaultStorageType(raw, fallback = 'usb') {
  const value = String(raw ?? fallback).trim().toLowerCase();
  if (
    value === 'onedrive' ||
    value === 'tutadrive' ||
    value === 'tutacloud' ||
    value === 'cloud'
  ) {
    return 'onedrive';
  }
  return 'usb';
}

function vaultSessionKey(singlesId, storageType = 'usb') {
  return `${Number(singlesId)}:${normalizeVaultStorageType(storageType)}`;
}

export function readRequestedVaultStorageType(req) {
  const headerValue = req?.headers?.[RECORD_VAULT_STORAGE_HEADER] ?? req?.headers?.['X-Record-Vault-Storage'];
  const queryValue = req?.query?.storageType ?? req?.query?.storage_type;
  const raw = String(headerValue ?? queryValue ?? '').trim();
  return raw ? normalizeVaultStorageType(raw) : null;
}

/**
 * One unlocked vault on this worker. The notes index lives in Postgres (session.db is a
 * VaultPgDb scoped to the member), so every worker reads the same rows — nothing to reload
 * or persist between requests. Media files stay under the vault folder on shared storage.
 */
class VaultSession {
  constructor({ singlesId, mountPath, backupMountPath = null, db, key, meta }) {
    this.singlesId = singlesId;
    this.mountPath = mountPath;
    this.backupMountPath = backupMountPath ? path.resolve(backupMountPath) : null;
    this.db = db;
    this.key = key;
    this.meta = meta;
    /** Always false: writes commit to Postgres immediately (read by vaultClusterCoherence). */
    this.dirty = false;
    this.locked = false;
    this.storageType = 'usb';
    this.driveSinglesId = null;
    this.driveFolderId = null;
    /** FE/BE: tree open already counted toward session ui/usb tx/rx. */
    this.sessionFileCountsTreeReported = false;
    /** vault_cluster_state unlock_generation / db_version this session was opened at. */
    this.clusterGeneration = null;
    this.clusterDbVersion = null;
    this.clusterFlushedSinceCommit = false;
  }
}

function getMirrorMountPaths(session) {
  if (!session) return [];
  const paths = [session.mountPath];
  if (session.backupMountPath && session.backupMountPath !== session.mountPath) {
    paths.push(session.backupMountPath);
  }
  return paths;
}

function copyEntryRecursive(srcPath, destPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const name of fs.readdirSync(srcPath)) {
      copyEntryRecursive(path.join(srcPath, name), path.join(destPath, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

function removeDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export function assertBackupMountPath(primaryMountPath, backupMountPath, expectedVaultId) {
  const backupRaw = String(backupMountPath ?? '').trim();
  if (!backupRaw) return null;
  const primary = path.resolve(primaryMountPath);
  const backup = path.resolve(backupRaw);
  if (backup === primary) {
    throw new Error('Backup USB must be different from primary USB');
  }
  const backupRoot = vaultRootOnMount(backup);
  if (!fs.existsSync(backupRoot)) {
    return backup;
  }
  const backupMeta = readVaultMeta(backup);
  if (!backupMeta?.vaultId) {
    return backup;
  }
  if (Number(backupMeta.version) === 1) {
    throw new Error('Backup folder has an older PIN vault. Pick an empty folder instead.');
  }
  if (expectedVaultId && backupMeta.vaultId !== expectedVaultId) {
    throw new Error(
      `Backup USB "${backup}" has a different vault than primary. Click Clear on the backup slot, Format that USB, or pick an empty drive.`
    );
  }
  return backup;
}

function syncVaultTreeToBackup(session) {
  if (!session?.backupMountPath) return;
  const sourceRoot = vaultRootOnMount(session.mountPath);
  const backupRoot = vaultRootOnMount(session.backupMountPath);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error('Primary vault folder is missing');
  }
  removeDirRecursive(backupRoot);
  copyEntryRecursive(sourceRoot, backupRoot);
}

function writeToMirrorPaths(session, writer) {
  const paths = getMirrorMountPaths(session);
  let primaryError = null;
  for (let i = 0; i < paths.length; i += 1) {
    const mountPath = paths[i];
    try {
      writer(mountPath);
    } catch (err) {
      if (i === 0) primaryError = err;
      console.error('[recordVaultUsb mirror]', mountPath, err?.message || err);
    }
  }
  if (primaryError) throw primaryError;
}

export function writeEncryptedPhoto(session, relativePath, buffer) {
  const enc = sealVaultBuffer(buffer, session.key);
  writeToMirrorPaths(session, (mountPath) => {
    const abs = vaultPhotoStoragePath(mountPath, relativePath, session.meta);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, enc);
  });
}

export function readEncryptedPhoto(session, relativePath) {
  const abs = resolveVaultPhotoStoragePath(session.mountPath, relativePath);
  if (!fs.existsSync(abs)) return null;
  const enc = fs.readFileSync(abs);
  return openVaultBuffer(enc, session.key);
}

export function deleteEncryptedPhoto(session, relativePath) {
  if (!relativePath) return;
  writeToMirrorPaths(session, (mountPath) => {
    for (const abs of [
      vaultPhotoStoragePath(mountPath, relativePath, session.meta),
      resolveVaultPhotoStoragePath(mountPath, relativePath)
    ]) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        // ignore
      }
    }
  });
}

export function writeEncryptedVaultFile(session, relativePath, buffer) {
  const enc = sealVaultBuffer(buffer, session.key);
  writeToMirrorPaths(session, (mountPath) => {
    // Atomic: an interrupted write never leaves a truncated file under the final name.
    atomicWriteFileSync(vaultFileStoragePath(mountPath, relativePath, session.meta), enc);
  });
}

export function readEncryptedVaultFile(session, relativePath) {
  const abs = resolveVaultFileStoragePath(session.mountPath, relativePath);
  if (fs.existsSync(abs)) {
    try {
      const enc = fs.readFileSync(abs);
      const opened = openVaultBuffer(enc, session.key);
      if (opened?.length) return opened;
    } catch {
      // fall through
    }
  }
  return null;
}

/**
 * Resolve attachment bytes: shared_content_key → one global sample file;
 * else vault-encrypted (or plaintext) path under files/.
 */
export function readVaultAttachmentBuffer(session, row) {
  const shared = readRecordVaultSharedSampleForAttachmentRow(row);
  if (shared?.length) return shared;
  if (!row?.relative_path) return null;
  return readEncryptedVaultFile(session, row.relative_path);
}

export function deleteEncryptedVaultFile(session, relativePath) {
  if (!relativePath) return;
  writeToMirrorPaths(session, (mountPath) => {
    for (const abs of [
      vaultFileStoragePath(mountPath, relativePath, session.meta),
      resolveVaultFileStoragePath(mountPath, relativePath)
    ]) {
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        // ignore
      }
    }
  });
}

/** Notes index commits to Postgres immediately — keep exported names as no-ops. */
export function forcePersistVaultDb(_session) {}

export function flushDbToUsb(_session) {}

async function refreshNoteSearchText(db, noteId) {
  const sid = db.singlesId;
  const note = await db.one(
    `SELECT note_name, body_text, inner_encrypt_enabled FROM ${T.notes}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [sid, noteId]
  );
  if (!note) return;
  const kwRows = await db.all(
    `SELECT keyword FROM ${T.keywords} WHERE singles_id = $1 AND note_id = $2 ORDER BY keyword_normalized ASC`,
    [sid, noteId]
  );
  const attRows = await db.all(
    `SELECT file_name FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [sid, noteId]
  );
  const innerEncrypted =
    Number(note.inner_encrypt_enabled) === 1 ||
    String(note.body_text || '').startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
  // Strip HTML / data-URLs so search_text matches visible note text only.
  const bodyForSearch = innerEncrypted ? '' : expandRecordVaultBodyTextForSearch(note.body_text);
  const searchText = [note.note_name, bodyForSearch, ...kwRows.map((r) => r.keyword), ...attRows.map((r) => r.file_name)]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  await db.run(
    `UPDATE ${T.notes} SET search_text = $3, updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId, searchText]
  );
}

/**
 * Move inline `data:image;base64,…` out of body_text into TutaNotes/files/{nb}/{note}/{id}.ext
 * and leave `<img data-file-id="{id}">` pointers. No-op when none / inner-encrypted.
 * @returns {{ bodyText: string, extracted: number, failed: number }}
 */
export async function materializeInlineDataImagesInNoteBody(session, noteId, bodyText) {
  const raw = String(bodyText ?? '');
  if (!bodyHasInlineDataImage(raw)) {
    return { bodyText: raw, extracted: 0, failed: 0 };
  }
  const note = await loadNote(session.db, noteId);
  if (!note) throw new Error('Note not found');
  const notebookId = Number(note.notebook_id);

  const { html, extracted, failed } = await rewriteInlineDataImages(raw, async (decoded, index) => {
    const attachment = await vaultAddNoteAttachment(session, noteId, {
      buffer: decoded.buffer,
      fileName: `inline_${noteId}_${index + 1}.${decoded.ext}`,
      ext: decoded.ext,
      mimeType: decoded.mimeType
    });
    const fileId = Number(attachment?.attachment_id);
    if (!Number.isFinite(fileId) || fileId < 1) return null;
    // notebookId unused here — path comes from vaultAddNoteAttachment via fileRelativePath
    void notebookId;
    return { fileId };
  });

  if (extracted > 0 && html !== raw) {
    await session.db.run(
      `UPDATE ${T.notes} SET body_text = $3, updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
      [session.db.singlesId, noteId, html]
    );
    await refreshNoteSearchText(session.db, noteId);
  }
  return { bodyText: html, extracted, failed };
}

/** Extract inline images for every note that still has data: URLs (unlocked vault). */
export async function vaultExtractAllInlineDataImages(session) {
  const rows = await session.db.all(
    `SELECT note_id FROM ${T.notes}
      WHERE singles_id = $1 AND deleted_at IS NULL
        AND body_text LIKE '%data:image%'
      ORDER BY note_id ASC`,
    [session.db.singlesId]
  );
  let notesTouched = 0;
  let imagesExtracted = 0;
  let imagesFailed = 0;
  for (const row of rows) {
    const noteId = Number(row.note_id);
    const note = await loadNote(session.db, noteId);
    if (!note?.body_text) continue;
    const result = await materializeInlineDataImagesInNoteBody(session, noteId, note.body_text);
    if (result.extracted > 0) notesTouched += 1;
    imagesExtracted += result.extracted;
    imagesFailed += result.failed;
  }
  return { notesScanned: rows.length, notesTouched, imagesExtracted, imagesFailed };
}


export function getVaultSession(singlesId, storageType = null) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  if (storageType) {
    const session = sessionsByKey.get(vaultSessionKey(id, storageType));
    if (!session || session.locked) return null;
    return session;
  }
  const usbSession = sessionsByKey.get(vaultSessionKey(id, 'usb'));
  if (usbSession && !usbSession.locked) return usbSession;
  const oneDriveSession = sessionsByKey.get(vaultSessionKey(id, 'onedrive'));
  if (oneDriveSession && !oneDriveSession.locked) return oneDriveSession;
  return null;
}

export function listVaultSessions(singlesId) {
  const id = Number(singlesId);
  const out = [];
  for (const storageType of ['usb', 'onedrive']) {
    const session = getVaultSession(id, storageType);
    if (session) out.push(session);
  }
  return out;
}

/** Forget this worker's session (logged off / re-unlocked on another worker). */
function dropLocalVaultSession(singlesId, storageType) {
  const key = vaultSessionKey(singlesId, storageType);
  const session = sessionsByKey.get(key);
  if (!session) return;
  sessionsByKey.delete(key);
  session.locked = true;
}

/** Hooks for be/utils/vaultClusterCoherence.js (multi-worker / multi-server coherence). */
export const vaultClusterHooks = {
  readRequestedStorageType: readRequestedVaultStorageType,
  getLocalSession: (singlesId, storageType) => getVaultSession(singlesId, storageType),
  dropLocalSession: dropLocalVaultSession,
  rehydrateSession: (singlesId, storageType) => tryRehydrateVaultSession(singlesId, storageType),
  // Notes index is in Postgres: every worker already sees the latest rows.
  reloadSessionDb: async () => {},
  persistSessionNow: () => {}
};

let resolveVaultAccessSession = async (req, res) => requireVaultAccessSession(req, res);

/** Override access gate for local Record Vault bridge (header-based singles id). */
export function configureVaultAccessSessionResolver(resolver) {
  resolveVaultAccessSession = resolver;
}

export async function requireVaultSession(req, res) {
  const singlesId = await resolveVaultAccessSession(req, res);
  if (!singlesId) return null;

  const requestedType = readRequestedVaultStorageType(req);
  if (requestedType) {
    let session = getVaultSession(singlesId, requestedType);
    if (!session) {
      session = await tryRehydrateVaultSession(singlesId, requestedType);
    }
    if (!session) {
      res.status(428).json({
        error: 'Record Vault storage not unlocked',
        code: 'RECORD_VAULT_USB_REQUIRED',
        storageType: requestedType
      });
      return null;
    }
    return session;
  }

  let usbSession = getVaultSession(singlesId, 'usb');
  if (!usbSession) {
    usbSession = await tryRehydrateVaultSession(singlesId, 'usb');
  }
  let oneDriveSession = getVaultSession(singlesId, 'onedrive');
  if (!oneDriveSession) {
    oneDriveSession = await tryRehydrateVaultSession(singlesId, 'onedrive');
  }
  if (usbSession && oneDriveSession) {
    res.status(400).json({
      error: 'X-Record-Vault-Storage header is required when both cloud and USB vaults are unlocked',
      code: 'RECORD_VAULT_STORAGE_TYPE_REQUIRED'
    });
    return null;
  }

  const session = usbSession || oneDriveSession;
  if (!session) {
    res.status(428).json({
      error: 'Record Vault storage not unlocked',
      code: 'RECORD_VAULT_USB_REQUIRED'
    });
    return null;
  }
  return session;
}

async function resolveVaultUnlockKey(singlesId, storageType, mountPathHint = null) {
  const iconName = await readRecordVaultCacheIcon(singlesId, storageType);
  if (!iconName) return null;
  let mountPath = mountPathHint ? String(mountPathHint).trim() : '';
  if (!mountPath) {
    const cluster = await getVaultClusterUnlock(Number(singlesId), normalizeVaultStorageType(storageType));
    mountPath = String(cluster?.mountPath || '').trim();
  }
  if (!mountPath || !isVaultMountPathPresent(mountPath)) return null;
  try {
    const meta = readVaultMeta(mountPath);
    const keys = await listIconVaultUnlockKeys(iconName, meta);
    return keys[0]?.key ?? null;
  } catch {
    return null;
  }
}

/**
 * Re-seal photos/ + files/ under a new AES key and write Argon2id kdf meta.
 * Used once when unlocking a legacy SHA-256 icon vault.
 */
async function migrateSessionIconVaultToArgon2id(session, iconName) {
  if (!session || isPlaintextVaultKey(session.key) || vaultMetaUsesPlaintextStorage(session.meta)) {
    return false;
  }
  if (vaultMetaUsesArgon2idKdf(session.meta)) return false;

  const material = await createIconVaultKeyMaterial(iconName);
  const oldKey = session.key;
  const newKey = material.key;

  function resealFile(absPath) {
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) return;
    const enc = fs.readFileSync(absPath);
    try {
      const plain = openVaultBuffer(enc, oldKey);
      fs.writeFileSync(absPath, sealVaultBuffer(plain, newKey));
    } catch (err) {
      // Skip files that were not encrypted with the old icon key (corrupt / already plaintext).
      console.warn('[migrateSessionIconVaultToArgon2id] skip file', absPath, err?.message || err);
    }
  }

  function walkAndReseal(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walkAndReseal(abs);
      else resealFile(abs);
    }
  }

  walkAndReseal(vaultPhotosRoot(session.mountPath));
  walkAndReseal(vaultFilesRoot(session.mountPath));

  session.key = newKey;
  session.meta = {
    ...session.meta,
    version: 2,
    encryption: 'aes-256-gcm-icon-key',
    ...iconVaultKdfMetaFields(material)
  };
  fs.writeFileSync(vaultMetaPath(session.mountPath), JSON.stringify(session.meta, null, 2));

  if (session.backupMountPath && isVaultMountPathPresent(session.backupMountPath)) {
    try {
      walkAndReseal(vaultPhotosRoot(session.backupMountPath));
      walkAndReseal(vaultFilesRoot(session.backupMountPath));
      fs.writeFileSync(
        vaultMetaPath(session.backupMountPath),
        JSON.stringify(session.meta, null, 2)
      );
    } catch (err) {
      console.warn('[migrateSessionIconVaultToArgon2id] backup mirror failed', err?.message || err);
    }
  }

  console.log('[migrateSessionIconVaultToArgon2id] upgraded vault icon KDF to Argon2id', {
    singlesId: session.singlesId,
    storageType: session.storageType,
    vaultId: session.meta?.vaultId
  });
  return true;
}


/** In-flight rehydrates per session key — parallel requests must not open the vault twice. */
const rehydrateInFlight = new Map();

function tryRehydrateVaultSession(singlesId, storageType) {
  const key = vaultSessionKey(singlesId, storageType);
  let pending = rehydrateInFlight.get(key);
  if (!pending) {
    pending = rehydrateVaultSessionOnce(singlesId, storageType).finally(() => {
      rehydrateInFlight.delete(key);
    });
    rehydrateInFlight.set(key, pending);
  }
  return pending;
}

async function rehydrateVaultSessionOnce(singlesId, storageType) {
  const id = Number(singlesId);
  const normalizedType = normalizeVaultStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) return null;
  if (getVaultSession(id, normalizedType)) return getVaultSession(id, normalizedType);

  const cluster = await getVaultClusterUnlock(id, normalizedType);
  if (!cluster?.mountPath) return null;

  const mountPath = String(cluster.mountPath).trim();
  if (!isVaultMountPathPresent(mountPath)) {
    return null;
  }

  const key = await resolveVaultUnlockKey(id, normalizedType, mountPath);
  try {
    await unlockVaultUsbWithKey(id, mountPath, key, {
      skipBackup: normalizedType === 'onedrive' || !cluster.backupMountPath,
      backupMountPath: cluster.backupMountPath || null,
      storageType: normalizedType,
      skipClusterRegister: true,
      iconName: await readRecordVaultCacheIcon(id, normalizedType)
    });
  } catch (err) {
    rvCloudWarn('Vault', 'cluster rehydrate unlock failed', {
      singlesId: id,
      storageType: normalizedType,
      message: err?.message || String(err)
    });
    return null;
  }

  const session = getVaultSession(id, normalizedType);
  if (session) markVaultSessionClusterState(session, cluster);
  if (session && normalizedType === 'onedrive') {
    session.driveSinglesId = null;
    session.driveFolderId = null;
    session.tutaDrive = true;
    session.label = 'TutaDrive';
  }
  return session;
}

export async function initializeVaultOnUsb(mountPath, iconName) {
  const material = await createIconVaultKeyMaterial(iconName);
  return initializeVaultOnUsbWithKey(mountPath, material.key, material);
}

/**
 * Create the vault folder (vault.meta.json + photos/ + files/). The notes index itself is
 * created in Postgres — and seeded with the sample album — on the first unlock.
 */
export async function initializeVaultOnUsbWithKey(mountPath, key, kdfMaterial = null) {
  const normalized = path.resolve(mountPath);
  if (fs.existsSync(vaultMetaPath(normalized))) {
    throw new Error('A vault already exists on this USB');
  }
  try {
    fs.mkdirSync(vaultPhotosRoot(normalized), { recursive: true });
    fs.mkdirSync(vaultFilesRoot(normalized), { recursive: true });
  } catch (err) {
    const code = err?.code;
    if (code === 'EROFS' || code === 'EPERM' || code === 'EACCES' || code === 'ENOENT') {
      const wrapped = new Error(
        'Cannot create TutaNotes on this volume (read-only or not a real USB). ' +
          'Eject the Record Vault USB Bridge installer DMG if it is open, then pick your USB drive (for example TutaNotes).'
      );
      wrapped.code = code;
      wrapped.cause = err;
      wrapped.path = err?.path;
      throw wrapped;
    }
    throw err;
  }
  const plaintextStorage = !isVaultPhotoAndDbEncryptionEnabled() || isPlaintextVaultKey(key);
  const meta = {
    version: plaintextStorage ? 3 : 2,
    vaultId: crypto.randomUUID(),
    encryption: plaintextStorage ? 'none' : 'aes-256-gcm-icon-key',
    createdAt: new Date().toISOString(),
    ...(plaintextStorage ? {} : iconVaultKdfMetaFields(kdfMaterial))
  };
  if (!plaintextStorage && !meta.kdfSalt) {
    throw new Error(
      'Encrypted vault init requires Argon2id kdf material (kdfSalt). Use initializeVaultOnUsb(iconName) or pass createIconVaultKeyMaterial().'
    );
  }
  fs.writeFileSync(vaultMetaPath(normalized), JSON.stringify(meta, null, 2));
  return meta;
}

export async function unlockVaultUsb(singlesId, mountPath, iconName, options = {}) {
  const meta = readVaultMeta(mountPath);
  const keys = await listIconVaultUnlockKeys(iconName, meta);
  const key = keys[0]?.key;
  return unlockVaultUsbWithKey(singlesId, mountPath, key, {
    ...options,
    iconName,
    unlockKdf: keys[0]?.kdf || null
  });
}

/** Legacy vault.db / vault.db.enc files still in the vault folder (pre-Postgres vaults, restored zips). */
function listLegacyVaultDbPaths(mountPath, meta) {
  const vaultRoot = vaultRootOnMount(mountPath);
  const out = [];
  const candidates = [
    resolveVaultDbPath(mountPath),
    ...listVaultDbFileNamesForRead(meta).map((name) => path.join(vaultRoot, name))
  ];
  for (const abs of candidates) {
    if (abs && !out.includes(abs) && fs.existsSync(abs)) out.push(abs);
  }
  return out;
}

/** Imported vault.db files are renamed (kept as a fallback copy) so they are never imported twice. */
function retireLegacyVaultDbFiles(paths) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  for (const abs of paths) {
    const suffix = abs.endsWith('.enc') ? '.db.enc' : '.db';
    try {
      fs.renameSync(abs, path.join(path.dirname(abs), `vault-imported-to-postgres-${stamp}${suffix}`));
    } catch (err) {
      // Another worker unlocking at the same moment may have renamed it first.
      if (err?.code !== 'ENOENT') {
        console.warn('[recordVaultUsb] could not rename imported vault db', abs, err?.message || err);
      }
    }
  }
}

/**
 * Make sure the member's notes index for this vault folder is in Postgres.
 * - index present for this vaultId → use it (a stale vault.db next to it is renamed, not imported)
 * - vault.db present otherwise → import it (replaces any older index)
 * - nothing anywhere → create an empty index (`created: true`, caller seeds sample notes)
 */
async function ensureVaultIndexInPostgres({ singlesId, mountPath, meta, unlockKeys, defaultKey, retried = false }) {
  const vaultId = meta?.vaultId ? String(meta.vaultId) : null;
  const existing = await loadNotesMemberVault(singlesId);
  const legacyPaths = listLegacyVaultDbPaths(mountPath, meta);

  if (existing && (existing.vault_id === vaultId || !legacyPaths.length)) {
    if (vaultId && existing.vault_id !== vaultId) {
      console.warn('[recordVaultUsb] vault folder id changed; keeping the Postgres notes index', {
        singlesId,
        previousVaultId: existing.vault_id,
        vaultId
      });
      await setNotesMemberVaultId(singlesId, vaultId);
    }
    if (legacyPaths.length) retireLegacyVaultDbFiles(legacyPaths);
    return { effectiveKey: defaultKey, created: false, imported: false };
  }

  if (legacyPaths.length) {
    let openErr = null;
    for (const dbPath of legacyPaths) {
      let enc;
      try {
        enc = fs.readFileSync(dbPath);
      } catch (err) {
        // Another worker imported + renamed it a moment ago; its rows are in Postgres now.
        if (err?.code === 'ENOENT' && !retried) {
          return ensureVaultIndexInPostgres({ singlesId, mountPath, meta, unlockKeys, defaultKey, retried: true });
        }
        throw err;
      }
      for (const tryKey of unlockKeys) {
        let plain;
        try {
          plain = openVaultBuffer(enc, tryKey);
        } catch (err) {
          openErr = err;
          continue;
        }
        if (!isSqliteVaultDbBuffer(plain)) continue;
        const sqliteDb = await openLegacySqliteVaultBuffer(plain);
        try {
          const counts = await importSqliteVaultIntoPostgres(singlesId, sqliteDb, {
            vaultId,
            source: existing ? 'restore' : 'import',
            importedFromPath: dbPath
          });
          console.info('[recordVaultUsb] imported vault.db into Postgres', { singlesId, dbPath, counts });
        } finally {
          sqliteDb.close();
        }
        retireLegacyVaultDbFiles(legacyPaths);
        return { effectiveKey: tryKey, created: false, imported: true };
      }
    }
    throw openErr || new Error('Vault database is missing or unreadable');
  }

  await new VaultPgDb(singlesId).tx((tx) => createNotesMemberVault(tx, { vaultId, source: 'seed' }));
  return { effectiveKey: defaultKey, created: true, imported: false };
}

/**
 * Bulk migration (no session): import the legacy vault.db in a vault folder into Postgres.
 * `key` is the vault's unlock key (null for plaintext vaults). Folders without vault.db are skipped.
 */
export async function importLegacyRecordVaultVaultDb(singlesId, mountPath, key = null) {
  const meta = readVaultMeta(mountPath);
  if (!meta?.vaultId || !listLegacyVaultDbPaths(mountPath, meta).length) {
    return { imported: false, reason: 'no_vault_db' };
  }
  const hasIconKey = key != null && !isPlaintextVaultKey(key);
  const unlockKeys = vaultMetaUsesPlaintextStorage(meta) ? [null, ...(hasIconKey ? [key] : [])] : hasIconKey ? [key] : [];
  if (!unlockKeys.length) return { imported: false, reason: 'key_required' };
  const result = await ensureVaultIndexInPostgres({
    singlesId: Number(singlesId),
    mountPath,
    meta,
    unlockKeys,
    defaultKey: null
  });
  return { imported: result.imported, reason: result.imported ? 'imported' : 'already_in_postgres' };
}

export async function unlockVaultUsbWithKey(singlesId, mountPath, key, options = {}) {
  const targetStorageType = normalizeVaultStorageType(options?.storageType, 'usb');
  ensureVaultLayoutDirs(mountPath);
  let templateApplied = false;
  if (tutaNotesTemplateZipAvailable()) {
    try {
      const tpl = await applyTutaNotesTemplate(mountPath);
      templateApplied = Boolean(tpl.applied);
    } catch (err) {
      console.warn('[unlockVaultUsbWithKey] template apply failed:', err?.message || err);
    }
  }
  const check = validateVaultOnMount(mountPath, { requireDbFile: false });
  if (!check.ok) {
    throw new Error(check.error || 'Invalid vault USB');
  }
  const meta = readVaultMeta(mountPath);
  if (Number(meta?.version) === 1) {
    throw new Error(
      'This USB vault uses the retired 6-digit PIN format. Create a new vault in a different folder.'
    );
  }
  const vaultRoot = vaultRootOnMount(mountPath);
  const hasEncryptedDbFile = fs.existsSync(path.join(vaultRoot, VAULT_DB_FILE_ENCRYPTED));
  const metaSaysPlaintext = vaultMetaUsesPlaintextStorage(meta);
  const hasIconKey = key != null && !isPlaintextVaultKey(key);
  const treatAsEncryptedVault = !metaSaysPlaintext || hasEncryptedDbFile;

  if (treatAsEncryptedVault && !hasIconKey) {
    throw new Error('Security icon is required to unlock this vault');
  }
  if (treatAsEncryptedVault) {
    assertUnlockNotLocked(mountPath, meta);
  }
  const backupMountPath =
    options?.skipBackup || !isVaultBackupUsbEnabled()
      ? null
      : assertBackupMountPath(mountPath, options?.backupMountPath, meta?.vaultId || null);

  const unlockKeys = [];
  if (!metaSaysPlaintext) {
    if (hasIconKey) unlockKeys.push(key);
  } else {
    unlockKeys.push(null);
    if (hasIconKey && hasEncryptedDbFile) unlockKeys.push(key);
  }

  let effectiveKey = null;
  let sampleSeedStatus = 'skipped';
  const db = new VaultPgDb(singlesId);
  try {
    const loaded = await ensureVaultIndexInPostgres({
      singlesId: Number(singlesId),
      mountPath,
      meta,
      unlockKeys,
      defaultKey: metaSaysPlaintext ? null : key
    });
    effectiveKey = loaded.effectiveKey;
    const allowSeed = !readNewMemberSampleSeededStamp(mountPath);
    sampleSeedStatus = templateApplied
      ? 'template'
      : await ensureRecordVaultNewMemberSampleDb(db, { allowSeed });
    if (
      sampleSeedStatus === 'inserted' ||
      sampleSeedStatus === 'template' ||
      sampleSeedStatus === 'present' ||
      sampleSeedStatus === 'upgraded'
    ) {
      stampNewMemberSampleSeeded(mountPath);
    }
  } catch (err) {
    if (err?.name === 'RecordVaultUnlockError') throw err;
    if (treatAsEncryptedVault) {
      recordFailedUnlockAttempt(mountPath, meta);
    }
    throw err;
  }

  let clearedMeta = clearUnlockGuard(mountPath, meta);
  if (metaSaysPlaintext && effectiveKey != null && !isPlaintextVaultKey(effectiveKey)) {
    clearedMeta = {
      ...clearedMeta,
      version: 2,
      encryption: 'aes-256-gcm-icon-key'
    };
    fs.writeFileSync(vaultMetaPath(mountPath), JSON.stringify(clearedMeta, null, 2));
  }

  const existing = getVaultSession(singlesId, targetStorageType);
  if (existing) {
    if (options?.skipClusterRegister) {
      dropLocalVaultSession(singlesId, targetStorageType);
    } else {
      await logoffVaultUsb(singlesId, targetStorageType);
    }
  }

  const session = new VaultSession({
    singlesId: Number(singlesId),
    mountPath: path.resolve(mountPath),
    backupMountPath,
    db,
    key: effectiveKey,
    meta: clearedMeta
  });
  session.storageType = targetStorageType;
  sessionsByKey.set(vaultSessionKey(singlesId, targetStorageType), session);
  if (sampleSeedStatus !== 'template') {
    try {
      await seedRecordVaultNewMemberSampleMedia({
        mountPath: session.mountPath,
        key: session.key,
        meta: session.meta,
        db: session.db
      });
    } catch (err) {
      console.warn('[recordVault] shared sample media link failed', err?.message || err);
    }
  }
  if (!options?.skipClusterRegister) {
    const clusterState = await registerVaultClusterUnlock({
      singlesId,
      storageType: targetStorageType,
      mountPath: session.mountPath,
      backupMountPath: session.backupMountPath,
      driveFolderId: session.driveFolderId || null
    });
    if (clusterState) markVaultSessionClusterState(session, clusterState);
  }

  const migrateIconName = String(options?.iconName || '').trim();
  if (
    migrateIconName &&
    treatAsEncryptedVault &&
    !isPlaintextVaultKey(session.key) &&
    !vaultMetaUsesArgon2idKdf(session.meta)
  ) {
    try {
      await migrateSessionIconVaultToArgon2id(session, migrateIconName);
    } catch (migErr) {
      console.error('[unlockVaultUsbWithKey] Argon2id KDF migrate failed', migErr?.message || migErr);
    }
  }

  fs.mkdirSync(vaultFilesRoot(session.mountPath), { recursive: true });
  if (session.backupMountPath) {
    syncVaultTreeToBackup(session);
  }

  const skipSessionCountReset = Boolean(options?.skipClusterRegister);
  if (!skipSessionCountReset) {
    const otherType = targetStorageType === 'onedrive' ? 'usb' : 'onedrive';
    const otherOpen =
      Boolean(getVaultSession(session.singlesId, otherType)) ||
      Boolean(await getVaultClusterUnlock(session.singlesId, otherType));
    if (!otherOpen) {
      await resetVaultSessionFileCounts(session.singlesId);
    }
  }
  let openItemCount = 0;
  if (targetStorageType === 'usb') {
    openItemCount = await countVaultSessionNotebooksAndNotes(session);
    if (openItemCount > 0) {
      await addVaultSessionFileCounts(session.singlesId, { usbDelta: openItemCount });
    }
  }

  return {
    mountPath: session.mountPath,
    label: path.basename(session.mountPath),
    vaultId: clearedMeta.vaultId,
    backupMountPath: session.backupMountPath,
    backupLabel: session.backupMountPath ? path.basename(session.backupMountPath) : null,
    sessionOpenItemCount: openItemCount
  };
}

/**
 * @param {number} singlesId
 * @param {string|null} [storageType]
 * @param {{ onProgress?: (p: { percent: number, label?: string }) => (void|Promise<void>) }} [opts]
 */
export async function logoffVaultUsb(singlesId, storageType = null, opts = {}) {
  const id = Number(singlesId);
  const rawOnProgress = typeof opts?.onProgress === 'function' ? opts.onProgress : null;
  /** Progress UI must never fail Cloud/USB logoff. */
  const onProgress = rawOnProgress
    ? async (payload) => {
        try {
          await rawOnProgress(payload);
        } catch {
          // ignore
        }
      }
    : null;
  if (!Number.isFinite(id) || id < 1) return { success: true };

  if (!storageType) {
    await logoffVaultUsb(id, 'usb', opts);
    await logoffVaultUsb(id, 'onedrive', opts);
    return { success: true };
  }

  const normalizedType = normalizeVaultStorageType(storageType);
  const session = getVaultSession(id, normalizedType);
  try {
    if (onProgress) await onProgress({ percent: 100, label: 'Done' });
  } finally {
    if (session) {
      session.locked = true;
      if (session.key) session.key.fill(0);
      sessionsByKey.delete(vaultSessionKey(id, normalizedType));
    }
    await clearVaultClusterUnlock(id, normalizedType);
    await flushVaultTransferBytes(id);
    // Freeze totals for login-gate display (survives unlock reset / rehydrate).
    await snapshotVaultSessionFileCountsToLast(id);
  }
  return { success: true };
}

/** Notes index writes commit to Postgres immediately; nothing to flush. */
export async function flushAndAwaitCloudSync(_singlesId, _storageType = 'onedrive', _opts = {}) {
  return { success: true, synced: false };
}

/** Close the vault on every worker without logoff side effects (e.g. after restore from zip). */
export async function discardVaultSessionWithoutCloudSync(singlesId, storageType = 'onedrive') {
  const normalizedType = normalizeVaultStorageType(storageType);
  const id = Number(singlesId);
  const session = getVaultSession(id, normalizedType);
  if (session) {
    session.locked = true;
    if (session.key) session.key.fill(0);
    sessionsByKey.delete(vaultSessionKey(id, normalizedType));
  }
  await clearVaultClusterUnlock(id, normalizedType);
  await flushVaultTransferBytes(id);
  return { success: true };
}

const ATTACHMENT_COLUMNS =
  'attachment_id, note_id, file_name, file_extension, file_size_bytes, checksum, mime_type, display_order, shared_content_key, created_at';
const ATTACHMENT_COLUMNS_WITH_PATH = `${ATTACHMENT_COLUMNS}, relative_path`;

function mapAttachmentRow(row) {
  return {
    attachment_id: Number(row.attachment_id),
    note_id: Number(row.note_id),
    file_name: row.file_name,
    file_extension: row.file_extension,
    file_size_bytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : 0,
    mime_type: row.mime_type || null,
    display_order: Number(row.display_order ?? 0),
    shared_content_key: row.shared_content_key || null,
    created_at: row.created_at
  };
}

/** Next permanent album photo seq for a note (1-based). */

async function loadAttachmentsForNote(db, noteId) {
  const rows = await db.all(
    `SELECT ${ATTACHMENT_COLUMNS_WITH_PATH}
       FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL
      ORDER BY display_order ASC, attachment_id ASC`,
    [db.singlesId, noteId]
  );
  return rows.map(mapAttachmentRow);
}

/**
 * Soft-delete note attachment rows that share byte size + SHA-256 checksum.
 * Keeps the lowest attachment_id; deletes hard files for the rest.
 * Also purges orphan byte-identical files under ENV staging / PHOTOALBUMS_FOLDER.
 * @returns {Promise<{ removedAttachmentIds: number[], kept: number }>}
 */

function mapExtraImageRow(row) {
  return {
    image_id: Number(row.image_id),
    note_id: Number(row.note_id),
    file_name: row.file_name,
    file_extension: row.file_extension,
    file_size_bytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : 0,
    display_order: Number(row.display_order ?? 0),
    created_at: row.created_at
  };
}

async function loadExtraImagesForNote(db, noteId) {
  const rows = await db.all(
    `SELECT image_id, note_id, file_name, file_extension, file_size_bytes, display_order, created_at
       FROM ${T.extraImages}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL
      ORDER BY display_order ASC, image_id ASC`,
    [db.singlesId, noteId]
  );
  return rows.map(mapExtraImageRow);
}

function mapNoteRowMetadata(row) {
  return {
    note_id: Number(row.note_id),
    notebook_id: Number(row.notebook_id),
    note_name: row.note_name,
    inner_encrypt_enabled: Number(row.inner_encrypt_enabled) === 1,
    inner_unlock_locked_until: row.inner_unlock_locked_until
      ? String(row.inner_unlock_locked_until)
      : '',
    image_file_name: row.image_file_name,
    image_file_extension: row.image_file_extension,
    image_relative_path: row.image_relative_path,
    image_file_size_bytes: row.image_file_size_bytes != null ? Number(row.image_file_size_bytes) : null,
    image_top_file_name: row.image_top_file_name,
    image_top_file_extension: row.image_top_file_extension,
    image_top_relative_path: row.image_top_relative_path,
    image_top_file_size_bytes:
      row.image_top_file_size_bytes != null ? Number(row.image_top_file_size_bytes) : null,
    image_bottom_file_name: row.image_bottom_file_name,
    image_bottom_file_extension: row.image_bottom_file_extension,
    image_bottom_relative_path: row.image_bottom_relative_path,
    image_bottom_file_size_bytes:
      row.image_bottom_file_size_bytes != null ? Number(row.image_bottom_file_size_bytes) : null,
    display_order: Number(row.display_order),
    created_at: row.created_at,
    updated_at: row.updated_at,
    content_loaded: false
  };
}

function mapNoteRow(row, keywords = [], attachments = [], extraImages = []) {
  const innerEncryptEnabled =
    Number(row.inner_encrypt_enabled) === 1 ||
    String(row.body_text || '').startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
  return {
    note_id: Number(row.note_id),
    notebook_id: Number(row.notebook_id),
    note_name: row.note_name,
    body_text: row.body_text,
    inner_encrypt_enabled: innerEncryptEnabled,
    inner_pin_salt: row.inner_pin_salt ? String(row.inner_pin_salt) : '',
    inner_unlock_locked_until: row.inner_unlock_locked_until
      ? String(row.inner_unlock_locked_until)
      : '',
    image_file_name: row.image_file_name,
    image_file_extension: row.image_file_extension,
    image_relative_path: row.image_relative_path,
    image_file_size_bytes: row.image_file_size_bytes != null ? Number(row.image_file_size_bytes) : null,
    image_top_file_name: row.image_top_file_name,
    image_top_file_extension: row.image_top_file_extension,
    image_top_relative_path: row.image_top_relative_path,
    image_top_file_size_bytes:
      row.image_top_file_size_bytes != null ? Number(row.image_top_file_size_bytes) : null,
    image_bottom_file_name: row.image_bottom_file_name,
    image_bottom_file_extension: row.image_bottom_file_extension,
    image_bottom_relative_path: row.image_bottom_relative_path,
    image_bottom_file_size_bytes:
      row.image_bottom_file_size_bytes != null ? Number(row.image_bottom_file_size_bytes) : null,
    display_order: Number(row.display_order),
    keywords,
    attachments,
    extra_images: extraImages,
    created_at: row.created_at,
    updated_at: row.updated_at,
    content_loaded: true
  };
}

async function loadNote(db, noteId) {
  return db.one(
    `SELECT note_id, notebook_id, note_name, body_text, display_order, created_at, updated_at,
            inner_encrypt_enabled, inner_pin_salt, inner_unlock_locked_until,
            image_file_name, image_file_extension, image_relative_path, image_checksum, image_file_size_bytes,
            image_top_file_name, image_top_file_extension, image_top_relative_path, image_top_checksum, image_top_file_size_bytes,
            image_bottom_file_name, image_bottom_file_extension, image_bottom_relative_path, image_bottom_checksum, image_bottom_file_size_bytes
       FROM ${T.notes} WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, noteId]
  );
}

async function loadKeywords(db, noteId) {
  const rows = await db.all(
    `SELECT keyword FROM ${T.keywords} WHERE singles_id = $1 AND note_id = $2 ORDER BY keyword_normalized ASC`,
    [db.singlesId, noteId]
  );
  return rows.map((r) => r.keyword);
}

async function mapNote(db, noteId) {
  const row = await loadNote(db, noteId);
  if (!row) return null;
  const [keywords, attachments, extraImages] = await Promise.all([
    loadKeywords(db, noteId),
    loadAttachmentsForNote(db, noteId),
    loadExtraImagesForNote(db, noteId)
  ]);
  return mapNoteRow(row, keywords, attachments, extraImages);
}

export async function vaultGetNote(session, noteId) {
  const row = await loadNote(session.db, noteId);
  if (row?.body_text && bodyHasInlineDataImage(row.body_text)) {
    await materializeInlineDataImagesInNoteBody(session, noteId, row.body_text);
  }
  return mapNote(session.db, noteId);
}

/** Notebook/note sidebar tree — metadata only; no body_text, keywords, attachments, or extra_images. */
export async function vaultGetTree(session) {
  const db = session.db;
  const sid = db.singlesId;
  const [notebooks, notes, shortcutRows] = await Promise.all([
    db.all(
      `SELECT notebook_id, notebook_name, display_order, created_at, updated_at
         FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL
        ORDER BY display_order ASC, notebook_id ASC`,
      [sid]
    ),
    db.all(
      `SELECT note_id, notebook_id, note_name, display_order, created_at, updated_at,
              inner_encrypt_enabled, inner_unlock_locked_until,
              image_file_name, image_file_extension, image_relative_path, image_file_size_bytes,
              image_top_file_name, image_top_file_extension, image_top_relative_path, image_top_file_size_bytes,
              image_bottom_file_name, image_bottom_file_extension, image_bottom_relative_path, image_bottom_file_size_bytes
         FROM ${T.notes} WHERE singles_id = $1 AND deleted_at IS NULL
        ORDER BY display_order ASC, note_id ASC`,
      [sid]
    ),
    db.all(
      `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
              nb.notebook_name, n.note_name
         FROM ${T.shortcuts} s
         JOIN ${T.notebooks} nb
           ON nb.singles_id = s.singles_id AND nb.notebook_id = s.notebook_id AND nb.deleted_at IS NULL
         LEFT JOIN ${T.notes} n
           ON n.singles_id = s.singles_id AND n.note_id = s.note_id AND n.deleted_at IS NULL
        WHERE s.singles_id = $1 AND (s.target_type = 'notebook' OR n.note_id IS NOT NULL)
        ORDER BY s.display_order ASC, s.shortcut_id ASC`,
      [sid]
    )
  ]);
  const notesByNotebook = new Map();
  for (const row of notes) {
    const notebookId = Number(row.notebook_id);
    if (!notesByNotebook.has(notebookId)) notesByNotebook.set(notebookId, []);
    notesByNotebook.get(notebookId).push(mapNoteRowMetadata(row));
  }
  return {
    notebooks: notebooks.map((nb) => ({
      notebook_id: Number(nb.notebook_id),
      notebook_name: nb.notebook_name,
      display_order: Number(nb.display_order),
      created_at: nb.created_at,
      updated_at: nb.updated_at,
      notes: notesByNotebook.get(Number(nb.notebook_id)) || []
    })),
    shortcuts: shortcutRows.map((row) => ({
      shortcut_id: Number(row.shortcut_id),
      target_type: row.target_type,
      notebook_id: Number(row.notebook_id),
      note_id: row.note_id != null ? Number(row.note_id) : null,
      label: row.target_type === 'notebook' ? row.notebook_name : row.note_name,
      display_order: Number(row.display_order)
    }))
  };
}

function noteHasInnerPinEncryption(row) {
  if (Number(row?.inner_encrypt_enabled) === 1) return true;
  return String(row?.body_text || '').startsWith(NOTE_INNER_ENCRYPT_BODY_PREFIX);
}

export async function vaultSearch(session, chain, evaluateChain) {
  const db = session.db;
  const [rows, keywordRows] = await Promise.all([
    db.all(
      `SELECT n.note_id, n.notebook_id, n.note_name, n.body_text, n.display_order, n.inner_encrypt_enabled,
              nb.notebook_name
         FROM ${T.notes} n
         JOIN ${T.notebooks} nb
           ON nb.singles_id = n.singles_id AND nb.notebook_id = n.notebook_id AND nb.deleted_at IS NULL
        WHERE n.singles_id = $1 AND n.deleted_at IS NULL
        ORDER BY n.notebook_id ASC, n.display_order ASC, n.note_id ASC`,
      [db.singlesId]
    ),
    db.all(
      `SELECT note_id, keyword FROM ${T.keywords} WHERE singles_id = $1 ORDER BY keyword_normalized ASC`,
      [db.singlesId]
    )
  ]);
  const keywordsByNote = new Map();
  for (const kw of keywordRows) {
    const noteId = Number(kw.note_id);
    if (!keywordsByNote.has(noteId)) keywordsByNote.set(noteId, []);
    keywordsByNote.get(noteId).push(kw.keyword);
  }
  const results = [];
  for (const row of rows) {
    // PIN-locked notes must not appear in search (name/body leak).
    if (noteHasInnerPinEncryption(row)) continue;
    const keywords = keywordsByNote.get(Number(row.note_id)) || [];
    const note = { note_name: row.note_name, body_text: row.body_text, keywords };
    if (evaluateChain(chain, (term) => noteMatchesRecordVaultSearchTerm(note, row.notebook_name, term))) {
      results.push({
        note_id: Number(row.note_id),
        notebook_id: Number(row.notebook_id),
        note_name: row.note_name,
        body_text: row.body_text,
        notebook_name: row.notebook_name,
        display_order: Number(row.display_order)
      });
    }
  }
  return results.slice(0, 50);
}

async function loadNotebookRow(db, notebookId) {
  return db.one(
    `SELECT notebook_id, notebook_name, display_order, created_at, updated_at
       FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2`,
    [db.singlesId, notebookId]
  );
}

export async function vaultCreateNotebook(session, notebookName) {
  const notebookId = await session.db.tx(async (tx) => {
    const orderRow = await tx.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
         FROM ${T.notebooks} WHERE singles_id = $1 AND deleted_at IS NULL`,
      [tx.singlesId]
    );
    const id = await tx.nextId('notebooks');
    await tx.run(
      `INSERT INTO ${T.notebooks} (singles_id, notebook_id, notebook_name, display_order)
       VALUES ($1, $2, $3, $4)`,
      [tx.singlesId, id, notebookName, Number(orderRow?.next_order ?? 0)]
    );
    return id;
  });
  return loadNotebookRow(session.db, notebookId);
}

export async function vaultUpdateNotebook(session, notebookId, notebookName) {
  await session.db.run(
    `UPDATE ${T.notebooks} SET notebook_name = $3, updated_at = NOW()
      WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
    [session.db.singlesId, notebookId, notebookName]
  );
  return loadNotebookRow(session.db, notebookId);
}

export async function vaultDeleteNotebook(session, notebookId) {
  await session.db.tx(async (tx) => {
    const noteRows = await tx.all(
      `SELECT note_id FROM ${T.notes} WHERE singles_id = $1 AND notebook_id = $2`,
      [tx.singlesId, notebookId]
    );
    for (const note of noteRows) {
      await deleteNoteData(session, tx, Number(note.note_id));
    }
    // Wipe leftover files/{notebookId}/ and photos/{notebookId}/ (orphans + empty dirs).
    removeNotebookMediaDirs(session, notebookId);
    await tx.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND notebook_id = $2`, [tx.singlesId, notebookId]);
    await tx.run(`DELETE FROM ${T.notes} WHERE singles_id = $1 AND notebook_id = $2`, [tx.singlesId, notebookId]);
    await tx.run(`DELETE FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2`, [tx.singlesId, notebookId]);
  });
}

export async function vaultReorderNotebooks(session, notebookIds) {
  await session.db.tx(async (tx) => {
    for (let i = 0; i < notebookIds.length; i += 1) {
      await tx.run(
        `UPDATE ${T.notebooks} SET display_order = $3, updated_at = NOW()
          WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
        [tx.singlesId, notebookIds[i], i]
      );
    }
  });
}

async function nextNoteDisplayOrder(db, notebookId) {
  const row = await db.one(
    `SELECT COALESCE(MIN(display_order), 0) - 1 AS next_order
       FROM ${T.notes} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, notebookId]
  );
  return Number(row?.next_order ?? -1);
}

export async function vaultCreateNote(
  session,
  notebookId,
  { noteName, bodyText, keywords, imageBuffer, imageExt, innerEncryptEnabled, innerPinSalt }
) {
  const noteId = await session.db.tx(async (tx) => {
    const nb = await tx.one(
      `SELECT notebook_id FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
      [tx.singlesId, notebookId]
    );
    if (!nb) throw new Error('Notebook not found');

    const displayOrder = await nextNoteDisplayOrder(tx, notebookId);
    const name = noteName || 'New Note';
    const body = bodyText ?? DEFAULT_BODY_TEXT;
    const innerEnabled = innerEncryptEnabled ? 1 : 0;
    const innerSalt = innerPinSalt ? String(innerPinSalt).trim().slice(0, 512) : null;
    const id = await tx.nextId('notes');
    await tx.run(
      `INSERT INTO ${T.notes} (singles_id, note_id, notebook_id, note_name, body_text, display_order, inner_encrypt_enabled, inner_pin_salt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tx.singlesId, id, notebookId, name, body, displayOrder, innerEnabled, innerSalt]
    );

    if (imageBuffer?.length) {
      const ext = imageExt || 'jpg';
      const relativePath = photoRelativePath(notebookId, id, 'center', ext);
      writeEncryptedPhoto(session, relativePath, imageBuffer);
      const checksum = crypto.createHash('sha256').update(imageBuffer).digest('hex');
      await tx.run(
        `UPDATE ${T.notes} SET image_relative_path = $3, image_file_extension = $4, image_file_size_bytes = $5,
                image_checksum = $6, image_file_name = $7, updated_at = NOW()
          WHERE singles_id = $1 AND note_id = $2`,
        [tx.singlesId, id, relativePath, ext, imageBuffer.length, checksum, `note_${id}`]
      );
    }

    if (keywords) {
      await vaultReplaceKeywords(tx, id, keywords);
    } else {
      await refreshNoteSearchText(tx, id);
    }
    return id;
  });
  if (bodyHasInlineDataImage(bodyText ?? '')) {
    await materializeInlineDataImagesInNoteBody(session, noteId, bodyText);
  }
  return mapNote(session.db, noteId);
}

function slotFields(slot) {
  if (slot === 'top') {
    return {
      relative: 'image_top_relative_path',
      ext: 'image_top_file_extension',
      size: 'image_top_file_size_bytes',
      checksum: 'image_top_checksum',
      name: 'image_top_file_name'
    };
  }
  if (slot === 'bottom') {
    return {
      relative: 'image_bottom_relative_path',
      ext: 'image_bottom_file_extension',
      size: 'image_bottom_file_size_bytes',
      checksum: 'image_bottom_checksum',
      name: 'image_bottom_file_name'
    };
  }
  return {
    relative: 'image_relative_path',
    ext: 'image_file_extension',
    size: 'image_file_size_bytes',
    checksum: 'image_checksum',
    name: 'image_file_name'
  };
}

async function clearSlotImageColumns(db, noteId, fields) {
  await db.run(
    `UPDATE ${T.notes} SET ${fields.relative} = NULL, ${fields.ext} = NULL, ${fields.size} = NULL,
            ${fields.checksum} = NULL, ${fields.name} = NULL, updated_at = NOW()
      WHERE singles_id = $1 AND note_id = $2`,
    [db.singlesId, noteId]
  );
}

async function updateNoteColumn(db, noteId, column, value) {
  await db.run(
    `UPDATE ${T.notes} SET ${column} = $3, updated_at = NOW() WHERE singles_id = $1 AND note_id = $2`,
    [db.singlesId, noteId, value]
  );
}

export async function vaultUpdateNote(session, noteId, patch) {
  const existing = await loadNote(session.db, noteId);
  if (!existing) throw new Error('Note not found');
  // Leaving TutaNotes always flushes the open note; an identical save must not dirty state.
  if (isUnchangedNoteTextPatch(existing, patch)) return mapNote(session.db, noteId);

  await session.db.tx(async (tx) => {
    const row = await loadNote(tx, noteId);
    if (!row) throw new Error('Note not found');

    if (patch.notebook_id != null && Number(patch.notebook_id) !== Number(row.notebook_id)) {
      const targetNb = Number(patch.notebook_id);
      const nb = await tx.one(
        `SELECT notebook_id FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2 AND deleted_at IS NULL`,
        [tx.singlesId, targetNb]
      );
      if (!nb) throw new Error('Target notebook not found');
      await updateNoteColumn(tx, noteId, 'notebook_id', targetNb);
    }

    if (patch.note_name != null) {
      await updateNoteColumn(tx, noteId, 'note_name', patch.note_name);
    }
    if (patch.body_text != null) {
      // Store raw first; materializeInlineDataImagesInNoteBody runs after the tx
      // (needs vaultAddNoteAttachment / disk writes outside this transaction).
      await updateNoteColumn(tx, noteId, 'body_text', patch.body_text);
    }
    if (patch.inner_encrypt_enabled != null) {
      await updateNoteColumn(tx, noteId, 'inner_encrypt_enabled', patch.inner_encrypt_enabled ? 1 : 0);
    }
    if (patch.inner_pin_salt !== undefined) {
      const salt = patch.inner_pin_salt == null ? null : String(patch.inner_pin_salt);
      await updateNoteColumn(tx, noteId, 'inner_pin_salt', salt);
    }
    if (patch.inner_unlock_locked_until !== undefined) {
      const until =
        patch.inner_unlock_locked_until == null || patch.inner_unlock_locked_until === ''
          ? null
          : String(patch.inner_unlock_locked_until).trim().slice(0, 64);
      await updateNoteColumn(tx, noteId, 'inner_unlock_locked_until', until);
    }

    for (const slot of ['center', 'top', 'bottom']) {
      const clearKey =
        slot === 'top' ? 'clear_image_top' : slot === 'bottom' ? 'clear_image_bottom' : 'clear_image';
      const imageKey = slot === 'top' ? 'image_top' : slot === 'bottom' ? 'image_bottom' : 'image';
      if (patch[clearKey]) {
        const fields = slotFields(slot);
        deleteEncryptedPhoto(session, row[fields.relative]);
        await clearSlotImageColumns(tx, noteId, fields);
      } else if (patch[`${imageKey}Parsed`]?.buffer?.length) {
        const parsed = patch[`${imageKey}Parsed`];
        const current = await loadNote(tx, noteId);
        const fields = slotFields(slot);
        const ext = parsed.ext || 'jpg';
        const relativePath = photoRelativePath(current.notebook_id, noteId, slot, ext);
        deleteEncryptedPhoto(session, current[fields.relative]);
        writeEncryptedPhoto(session, relativePath, parsed.buffer);
        const checksum = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
        await tx.run(
          `UPDATE ${T.notes} SET ${fields.relative} = $3, ${fields.ext} = $4, ${fields.size} = $5,
                  ${fields.checksum} = $6, ${fields.name} = $7, updated_at = NOW()
            WHERE singles_id = $1 AND note_id = $2`,
          [
            tx.singlesId,
            noteId,
            relativePath,
            ext,
            parsed.buffer.length,
            checksum,
            slot === 'center' ? `note_${noteId}` : `note_${noteId}_${slot}`
          ]
        );
      }
    }

    if (patch.keywords != null) {
      await vaultReplaceKeywords(tx, noteId, patch.keywords);
    } else {
      await refreshNoteSearchText(tx, noteId);
    }
  });
  if (patch.body_text != null && bodyHasInlineDataImage(patch.body_text)) {
    await materializeInlineDataImagesInNoteBody(session, noteId, patch.body_text);
  }
  return mapNote(session.db, noteId);
}

function normalizeVaultImageSlot(slot) {
  const normalized = String(slot || 'center').toLowerCase();
  if (normalized === 'top' || normalized === 'bottom' || normalized === 'center') return normalized;
  throw new Error('Invalid image slot');
}

function readSlotPlainImage(session, row, slot) {
  const fields = slotFields(slot);
  const relative = row[fields.relative];
  if (!relative) return null;
  return readEncryptedPhoto(session, relative);
}

async function writeSlotPlainImage(session, db, noteId, notebookId, slot, plainBuffer, meta = {}) {
  const fields = slotFields(slot);
  if (!plainBuffer?.length) {
    await clearSlotImageColumns(db, noteId, fields);
    return;
  }

  const ext = String(meta.ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const relativePath = photoRelativePath(notebookId, noteId, slot, ext);
  writeEncryptedPhoto(session, relativePath, plainBuffer);
  const checksum = meta.checksum || crypto.createHash('sha256').update(plainBuffer).digest('hex');
  const name = slot === 'center' ? `note_${noteId}` : `note_${noteId}_${slot}`;
  await db.run(
    `UPDATE ${T.notes} SET ${fields.relative} = $3, ${fields.ext} = $4, ${fields.size} = $5,
            ${fields.checksum} = $6, ${fields.name} = $7, updated_at = NOW()
      WHERE singles_id = $1 AND note_id = $2`,
    [db.singlesId, noteId, relativePath, ext, plainBuffer.length, checksum, name]
  );
}

export async function vaultMoveNoteImage(session, fromNoteId, fromSlot, toNoteId, toSlot) {
  const sourceSlot = normalizeVaultImageSlot(fromSlot);
  const targetSlot = normalizeVaultImageSlot(toSlot);
  const fromId = Number(fromNoteId);
  const toId = Number(toNoteId);
  if (!Number.isFinite(fromId) || fromId < 1 || !Number.isFinite(toId) || toId < 1) {
    throw new Error('Invalid note id');
  }
  if (fromId === toId && sourceSlot === targetSlot) {
    const note = await mapNote(session.db, fromId);
    return { fromNote: note, toNote: note };
  }

  await session.db.tx(async (tx) => {
    const fromRow = await loadNote(tx, fromId);
    const toRow = await loadNote(tx, toId);
    if (!fromRow || !toRow) throw new Error('Note not found');

    const plainFrom = readSlotPlainImage(session, fromRow, sourceSlot);
    if (!plainFrom?.length) throw new Error('Source image not found');

    const fromFields = slotFields(sourceSlot);
    const toFields = slotFields(targetSlot);
    const fromMeta = {
      ext: fromRow[fromFields.ext],
      checksum: fromRow[fromFields.checksum]
    };
    const toMeta = {
      ext: toRow[toFields.ext],
      checksum: toRow[toFields.checksum]
    };

    const plainTo = readSlotPlainImage(session, toRow, targetSlot);

    deleteEncryptedPhoto(session, fromRow[fromFields.relative]);
    if (toRow[toFields.relative] && toRow[toFields.relative] !== fromRow[fromFields.relative]) {
      deleteEncryptedPhoto(session, toRow[toFields.relative]);
    }

    await writeSlotPlainImage(session, tx, toId, toRow.notebook_id, targetSlot, plainFrom, fromMeta);

    if (plainTo?.length) {
      await writeSlotPlainImage(session, tx, fromId, fromRow.notebook_id, sourceSlot, plainTo, toMeta);
    } else {
      await clearSlotImageColumns(tx, fromId, fromFields);
    }

    await refreshNoteSearchText(tx, fromId);
    if (toId !== fromId) await refreshNoteSearchText(tx, toId);
  });
  return { fromNote: await mapNote(session.db, fromId), toNote: await mapNote(session.db, toId) };
}

/** Inside db.tx(). */
async function vaultReplaceKeywords(db, noteId, keywords) {
  await db.run(`DELETE FROM ${T.keywords} WHERE singles_id = $1 AND note_id = $2`, [db.singlesId, noteId]);
  const list = Array.isArray(keywords) ? keywords : [];
  const seen = new Set();
  for (const raw of list) {
    const keyword = String(raw ?? '').trim().slice(0, 80);
    const normalized = normalizeRecordVaultKeyword(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const keywordId = await db.nextId('keywords');
    await db.run(
      `INSERT INTO ${T.keywords} (singles_id, note_keyword_id, note_id, keyword, keyword_normalized)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (singles_id, note_id, keyword_normalized) DO NOTHING`,
      [db.singlesId, keywordId, noteId, keyword, normalized]
    );
  }
  await refreshNoteSearchText(db, noteId);
}

/**
 * Remove on-disk media for one album (note): files/{notebookId}/{noteId}/ (all att_* +
 * _1000px / _thumbnail siblings). Works under LARGE_CHEAP_STORAGE_FOLDER (TutaDrive).
 */
function removeNoteMediaDirs(session, notebookId, noteId) {
  const nb = String(notebookId);
  const nid = String(noteId);
  writeToMirrorPaths(session, (mountPath) => {
    removeDirRecursive(path.join(vaultFilesRoot(mountPath), nb, nid));
  });
}

function removeNotebookMediaDirs(session, notebookId) {
  const nb = String(notebookId);
  writeToMirrorPaths(session, (mountPath) => {
    removeDirRecursive(path.join(vaultFilesRoot(mountPath), nb));
    removeDirRecursive(path.join(vaultPhotosRoot(mountPath), nb));
  });
}

/** Inside db.tx(): delete one note's media files and every row that belongs to it. */
async function deleteNoteData(session, tx, noteId) {
  const sid = tx.singlesId;
  const row = await tx.one(
    `SELECT notebook_id, image_relative_path, image_top_relative_path, image_bottom_relative_path
       FROM ${T.notes} WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId]
  );
  if (!row) return false;
  for (const rel of [row.image_relative_path, row.image_top_relative_path, row.image_bottom_relative_path]) {
    deleteEncryptedPhoto(session, rel);
  }
  const extraImageRows = await tx.all(
    `SELECT relative_path FROM ${T.extraImages} WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId]
  );
  for (const img of extraImageRows) {
    deleteEncryptedPhoto(session, img.relative_path);
  }
  // Include already soft-deleted rows so orphaned disk files are still removed.
  const attachmentRows = await tx.all(
    `SELECT relative_path, shared_content_key, checksum, file_name FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId]
  );
  for (const att of attachmentRows) {
    if (!att.relative_path) continue;
    const sharedKey = resolveRecordVaultSharedContentKey({
      sharedContentKey: att.shared_content_key,
      checksum: att.checksum,
      fileName: att.file_name
    });
    if (!sharedKey) {
      deleteEncryptedVaultFile(session, att.relative_path);
    }
  }
  // Nuclear: remove entire album folder (catches any leftover variants / orphans).
  removeNoteMediaDirs(session, row.notebook_id, noteId);
  for (const table of [T.extraImages, T.keywords, T.attachments, T.shortcuts, T.notes]) {
    await tx.run(`DELETE FROM ${table} WHERE singles_id = $1 AND note_id = $2`, [sid, noteId]);
  }
  return true;
}

export async function vaultDeleteNote(session, noteId) {
  await session.db.tx(async (tx) => {
    const note = await loadNote(tx, noteId);
    if (!note) throw new Error('Note not found');
    await deleteNoteData(session, tx, noteId);
  });
}

export async function vaultReorderNotes(session, notebookId, noteIds) {
  await session.db.tx(async (tx) => {
    for (let i = 0; i < noteIds.length; i += 1) {
      await tx.run(
        `UPDATE ${T.notes} SET display_order = $4, updated_at = NOW()
          WHERE singles_id = $1 AND note_id = $2 AND notebook_id = $3 AND deleted_at IS NULL`,
        [tx.singlesId, noteIds[i], notebookId, i]
      );
    }
  });
}

function imageContentTypeForExt(extRaw) {
  const ext = String(extRaw || 'jpg').toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

export async function vaultGetNoteImage(session, noteId, slot = 'center') {
  const row = await loadNote(session.db, noteId);
  if (!row) return null;
  const fields = slotFields(slot);
  const relative = row[fields.relative];
  if (!relative) return null;
  const buffer = readEncryptedPhoto(session, relative);
  if (!buffer) return null;
  return { buffer, contentType: imageContentTypeForExt(row[fields.ext]) };
}

export async function vaultEnsureNotePhotoOnDisk(_session, _noteId, _slot = 'center') {}

export async function vaultEnsureNoteExtraImageOnDisk(_session, _noteId, _imageId) {}

export async function vaultEnsureNoteAttachmentOnDisk(_session, _noteId, _attachmentId, _opts = {}) {}

export async function vaultAddNoteExtraImage(session, noteId, { buffer, ext }) {
  if (!buffer?.length) throw new Error('Image is empty');
  await session.db.tx(async (tx) => {
    const row = await loadNote(tx, noteId);
    if (!row) throw new Error('Note not found');

    const cleanExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
    const orderRow = await tx.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
         FROM ${T.extraImages} WHERE singles_id = $1 AND note_id = $2`,
      [tx.singlesId, noteId]
    );
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const imageId = await tx.nextId('extraImages');
    const relativePath = extraPhotoRelativePath(row.notebook_id, noteId, imageId, cleanExt);
    await tx.run(
      `INSERT INTO ${T.extraImages}
         (singles_id, image_id, note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tx.singlesId,
        imageId,
        noteId,
        `note_${noteId}_extra`,
        cleanExt,
        relativePath,
        buffer.length,
        checksum,
        Number(orderRow?.next_order ?? 0)
      ]
    );
    writeEncryptedPhoto(session, relativePath, buffer);
  });
  return mapNote(session.db, noteId);
}

export async function vaultDeleteNoteExtraImage(session, noteId, imageId) {
  const db = session.db;
  const row = await db.one(
    `SELECT image_id, relative_path FROM ${T.extraImages}
      WHERE singles_id = $1 AND image_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [db.singlesId, imageId, noteId]
  );
  if (!row) throw new Error('Image not found');
  await db.run(`UPDATE ${T.extraImages} SET deleted_at = NOW() WHERE singles_id = $1 AND image_id = $2`, [
    db.singlesId,
    imageId
  ]);
  deleteEncryptedPhoto(session, row.relative_path);
  return mapNote(db, noteId);
}

export async function vaultGetNoteExtraImage(session, noteId, imageId) {
  const row = await session.db.one(
    `SELECT file_extension, relative_path FROM ${T.extraImages}
      WHERE singles_id = $1 AND image_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [session.db.singlesId, imageId, noteId]
  );
  if (!row?.relative_path) return null;
  const buffer = readEncryptedPhoto(session, row.relative_path);
  if (!buffer) return null;
  return { buffer, contentType: imageContentTypeForExt(row.file_extension) };
}


export async function vaultAddNoteAttachment(session, noteId, { buffer, fileName, ext, mimeType }) {
  const db = session.db;
  const row = await loadNote(db, noteId);
  if (!row) throw new Error('Note not found');
  if (!buffer?.length) throw new Error('File is empty');

  const cleanExt = String(ext || 'bin').replace(/^\./, '').toLowerCase();
  const safeName =
    String(fileName || `file.${cleanExt}`)
      .trim()
      .slice(0, 240) || `file.${cleanExt}`;
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const resolvedMime = mimeType || mimeTypeForRecordVaultExtension(cleanExt);

  const attachmentId = await db.tx(async (tx) => {
    const orderRow = await tx.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
         FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2`,
      [tx.singlesId, noteId]
    );
    const id = await tx.nextId('attachments');
    const relativePath = fileRelativePath(row.notebook_id, noteId, id, cleanExt);
    await tx.run(
      `INSERT INTO ${T.attachments}
         (singles_id, attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes,
          checksum, mime_type, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tx.singlesId,
        id,
        noteId,
        safeName,
        cleanExt,
        relativePath,
        buffer.length,
        checksum,
        resolvedMime,
        Number(orderRow?.next_order ?? 0)
      ]
    );
    writeEncryptedVaultFile(session, relativePath, buffer);
    await refreshNoteSearchText(tx, noteId);
    return id;
  });

  return mapAttachmentRow(
    await db.one(
      `SELECT ${ATTACHMENT_COLUMNS_WITH_PATH} FROM ${T.attachments}
        WHERE singles_id = $1 AND attachment_id = $2`,
      [db.singlesId, attachmentId]
    )
  );
}

export async function vaultDeleteNoteAttachment(session, noteId, attachmentId) {
  const db = session.db;
  const row = await db.one(
    `SELECT attachment_id, relative_path, shared_content_key, checksum, file_name
       FROM ${T.attachments}
      WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [db.singlesId, attachmentId, noteId]
  );
  // Idempotent: inline body may reference an attachment whose row is already gone.
  if (!row) {
    return { success: true, attachment_id: Number(attachmentId), already_deleted: true };
  }
  await db.tx(async (tx) => {
    await tx.run(
      `UPDATE ${T.attachments} SET deleted_at = NOW() WHERE singles_id = $1 AND attachment_id = $2`,
      [tx.singlesId, attachmentId]
    );
    await refreshNoteSearchText(tx, noteId);
  });
  const sharedKey = resolveRecordVaultSharedContentKey({
    sharedContentKey: row.shared_content_key,
    checksum: row.checksum,
    fileName: row.file_name
  });
  if (!sharedKey) {
    deleteEncryptedVaultFile(session, row.relative_path);
  }
  return { success: true, attachment_id: Number(attachmentId) };
}

export async function vaultGetNoteAttachment(session, noteId, attachmentId) {
  const row = await session.db.one(
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, mime_type,
            checksum, shared_content_key
       FROM ${T.attachments}
      WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [session.db.singlesId, attachmentId, noteId]
  );
  if (!row) return null;
  const buffer = readVaultAttachmentBuffer(session, row);
  if (!buffer) return null;
  const ext = String(row.file_extension || '').toLowerCase();
  return {
    buffer,
    fileName: row.file_name,
    contentType: row.mime_type || mimeTypeForRecordVaultExtension(ext)
  };
}


function mapShortcutRow(row) {
  return {
    shortcut_id: Number(row.shortcut_id),
    target_type: row.target_type,
    notebook_id: Number(row.notebook_id),
    note_id: row.note_id != null ? Number(row.note_id) : null,
    label: row.label || '',
    display_order: Number(row.display_order ?? 0)
  };
}

export async function vaultCreateShortcut(session, { targetType, notebookId, noteId }) {
  return session.db.tx(async (tx) => {
    const sid = tx.singlesId;
    const existing =
      targetType === 'notebook'
        ? await tx.one(
            `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
                    nb.notebook_name AS label
               FROM ${T.shortcuts} s
               JOIN ${T.notebooks} nb ON nb.singles_id = s.singles_id AND nb.notebook_id = s.notebook_id
              WHERE s.singles_id = $1 AND s.target_type = 'notebook' AND s.notebook_id = $2 AND nb.deleted_at IS NULL
              LIMIT 1`,
            [sid, notebookId]
          )
        : await tx.one(
            `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
                    n.note_name AS label
               FROM ${T.shortcuts} s
               JOIN ${T.notes} n ON n.singles_id = s.singles_id AND n.note_id = s.note_id
              WHERE s.singles_id = $1 AND s.target_type = 'note' AND s.notebook_id = $2 AND s.note_id = $3
                AND n.deleted_at IS NULL
              LIMIT 1`,
            [sid, notebookId, noteId]
          );
    if (existing) return mapShortcutRow(existing);

    const orderRow = await tx.one(
      `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM ${T.shortcuts} WHERE singles_id = $1`,
      [sid]
    );
    const displayOrder = Number(orderRow?.next_order ?? 0);
    const shortcutId = await tx.nextId('shortcuts');
    await tx.run(
      `INSERT INTO ${T.shortcuts} (singles_id, shortcut_id, target_type, notebook_id, note_id, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sid, shortcutId, targetType, notebookId, targetType === 'note' ? noteId : null, displayOrder]
    );
    const labelRow =
      targetType === 'notebook'
        ? await tx.one(`SELECT notebook_name AS label FROM ${T.notebooks} WHERE singles_id = $1 AND notebook_id = $2`, [
            sid,
            notebookId
          ])
        : await tx.one(`SELECT note_name AS label FROM ${T.notes} WHERE singles_id = $1 AND note_id = $2`, [sid, noteId]);
    return mapShortcutRow({
      shortcut_id: shortcutId,
      target_type: targetType,
      notebook_id: notebookId,
      note_id: targetType === 'note' ? noteId : null,
      label: labelRow?.label,
      display_order: displayOrder
    });
  });
}

export async function vaultDeleteShortcut(session, shortcutId) {
  await session.db.run(`DELETE FROM ${T.shortcuts} WHERE singles_id = $1 AND shortcut_id = $2`, [
    session.db.singlesId,
    shortcutId
  ]);
}

export async function vaultReorderShortcuts(session, shortcutIds) {
  await session.db.tx(async (tx) => {
    for (let i = 0; i < shortcutIds.length; i += 1) {
      await tx.run(
        `UPDATE ${T.shortcuts} SET display_order = $3, updated_at = NOW() WHERE singles_id = $1 AND shortcut_id = $2`,
        [tx.singlesId, shortcutIds[i], i]
      );
    }
  });
}

export async function vaultUsbStatus(singlesId, storageType = null) {
  const id = Number(singlesId);
  let session = storageType ? getVaultSession(id, storageType) : getVaultSession(id);
  if (!session && storageType) {
    session = await tryRehydrateVaultSession(id, storageType);
  } else if (!session) {
    session =
      (await tryRehydrateVaultSession(id, 'usb')) || (await tryRehydrateVaultSession(id, 'onedrive'));
  }
  return {
    unlocked: Boolean(session),
    storageType: session?.storageType || null,
    mountPath: session?.mountPath || null,
    label:
      session?.storageType === 'onedrive'
        ? session?.label || 'TutaDrive'
        : session
          ? path.basename(session.mountPath)
          : null,
    vaultId: session?.meta?.vaultId || null,
    backupMountPath: session?.backupMountPath || null,
    backupLabel: session?.backupMountPath ? path.basename(session.backupMountPath) : null,
    driveFolderId: session?.driveFolderId || null
  };
}

/** Nested folder tree of the unlocked USB vault root (files + folders). */
export function listUsbVaultFolderListing(singlesId, { maxDepth = 8 } = {}) {
  const session = getVaultSession(singlesId, 'usb');
  return buildVaultFolderListing(session, vaultRootOnMount, { maxDepth });
}

/** TutaDrive uses the 'onedrive' session slot with a local mount (LEFT_SIDE=TutaDrive). */
export function listTutaDriveVaultFolderListing(singlesId, { maxDepth = 8 } = {}) {
  const session = getVaultSession(singlesId, 'onedrive');
  return buildVaultFolderListing(session, vaultRootOnMount, { maxDepth });
}

export async function wipeVaultAtMountPath(mountPath, singlesId) {
  const match = resolveVolumeRootMountPath(mountPath);
  const normalized = path.resolve(match.mountPath);
  for (const session of listVaultSessions(singlesId)) {
    if (session.mountPath === normalized || session.backupMountPath === normalized) {
      throw new Error('Log off Record Vault before formatting this USB');
    }
  }
  const root = vaultRootOnMount(normalized);
  if (!fs.existsSync(root)) {
    return { wiped: false };
  }
  removeDirRecursive(root);
  await deleteNotesMemberVault(singlesId);
  return { wiped: true };
}
