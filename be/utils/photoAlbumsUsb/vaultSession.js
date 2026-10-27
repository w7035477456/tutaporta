import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  sealVaultBuffer,
  openVaultBuffer,
  isPlaintextVaultKey,
  isVaultPhotoAndDbEncryptionEnabled
} from './vaultCrypto.js';
import { removeDuplicateFilesInPhotoAlbumsEnvFolders } from '../photoAlbumsFolderDedupe.js';
import { countPhotoAlbumsAlbumMediaByNoteId } from '../photoAlbumsSidebarMediaCount.js';
import {
  createIconVaultKeyMaterial,
  iconVaultKdfMetaFields,
  listIconVaultUnlockKeys,
  vaultMetaUsesArgon2idKdf
} from '../photoAlbumsIconKeys.js';
import { isVaultBackupUsbEnabled } from '../photoAlbumsStorageFlags.js';
import { buildVaultFolderListing } from '../vaultFolderTreeListing.js';
import { vaultMetaUsesPlaintextStorage } from '../photoAlbumsIconEncryption.js';
import {
  fileRelativePath,
  parseAlbumPhotoSeqFromAttRelativePath,
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
  PHOTO_ALBUMS_VAULT_TABLES as T,
  VaultPgDb,
  createPhotoAlbumsMemberVault,
  importSqliteVaultIntoPostgres,
  loadPhotoAlbumsMemberVault,
  openLegacySqliteVaultBuffer,
  setPhotoAlbumsMemberVaultId
} from './vaultPgStore.js';
import {
  restorePhotoAlbumsSampleAlbumDb,
  sampleAttachmentIdFloor,
  seedPhotoAlbumsNewMemberSampleDb,
  seedPhotoAlbumsNewMemberSampleMedia
} from '../photoAlbumsNewMemberSample/seedPhotoAlbumsNewMemberSample.js';
import { migrateSampleAlbumTutorialLabelsDb } from '../photoAlbumsNewMemberSample/migrateSampleAlbumTutorialLabels.js';
import {
  readInitializeSampleVaultBuffer,
  isBundledInitializeSampleAttachmentId,
  linkInitializeSampleIntoVault
} from '../photoAlbumsNewMemberSample/initializeSampleMedia.js';
import {
  expandPhotoAlbumsBodyTextForSearch,
  normalizePhotoAlbumsKeyword,
  noteMatchesPhotoAlbumsSearchTerm
} from '../photoAlbumsSearch.js';
import { requireVaultAccessSession } from '../photoAlbumsAccessPassword.js';
import {
  mimeTypeForPhotoAlbumsExtension,
  isPhotoAlbumsStagingPhotoExtension,
  isPhotoAlbumsStagingVideoExtension
} from '../photoAlbumsFileFormats.js';
import {
  buildPhotoAlbumsDisplay1000pxBuffer,
  buildPhotoAlbumsThumbnailBuffer,
  fileRelativePathForVariant,
  isPhotoAlbumsRasterImageExtension,
  normalizeAttachmentVariant,
  normalizePhotoAlbumsAttachmentBuffer,
  photoAlbumsExtensionRequiresJpegFullFile
} from '../photoAlbumsAttachmentVariants.js';
import {
  buildPhotoAlbumsVideoPosterThumbnailBuffer,
  normalizePhotoAlbumsVideoBuffer
} from '../photoAlbumsNormalizeVideo.js';
import {
  isLeftSideTutaDrive,
  loadMemberIdForSingles,
  tutaDrivePhotoAlbumsMountPath
} from '../tutaDriveMemberPaths.js';
import {
  registerVaultClusterUnlock,
  clearVaultClusterUnlock,
  getVaultClusterUnlock,
  isVaultMountPathPresent
} from '../photoAlbumsClusterSession.js';
import { readPhotoAlbumsCacheIcon } from '../photoAlbumsCacheIcon.js';
import { flushVaultTransferBytes } from '../photoAlbumsTransferTracking.js';
import {
  addVaultSessionFileCounts,
  countVaultSessionNotebooksAndNotes,
  resetVaultSessionFileCounts,
  snapshotVaultSessionFileCountsToLast
} from '../photoAlbumsSessionFileCounts.js';
import { rvCloudWarn } from '../photoAlbumsCloudDebugLog.js';
import { markVaultSessionClusterState } from '../vaultClusterCoherence.js';

/** Prefix for FE inner-layer ciphertext stored in notes.body_text (Argon2id + AES-256-GCM). */
export const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

/** @type {Map<string, VaultSession>} */
const sessionsByKey = new Map();

export const PHOTO_ALBUMS_STORAGE_HEADER = 'x-record-vault-storage';

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
  const headerValue = req?.headers?.[PHOTO_ALBUMS_STORAGE_HEADER] ?? req?.headers?.['X-Record-Vault-Storage'];
  const queryValue = req?.query?.storageType ?? req?.query?.storage_type;
  const raw = String(headerValue ?? queryValue ?? '').trim();
  return raw ? normalizeVaultStorageType(raw) : null;
}

/**
 * One unlocked vault on this worker. The album index lives in Postgres (session.db is a
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
      console.error('[photoAlbumsUsb mirror]', mountPath, err?.message || err);
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
    const enc = fs.readFileSync(abs);
    const opened = openVaultBuffer(enc, session.key);
    if (opened?.length) return opened;
  }
  return readInitializeSampleVaultBuffer(relativePath, session.key);
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
  const bodyForSearch = innerEncrypted ? '' : expandPhotoAlbumsBodyTextForSearch(note.body_text);
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

async function runFolderDedupe(session, label) {
  try {
    await removeDuplicateFilesInPhotoAlbumsEnvFolders({ session });
  } catch (err) {
    console.error(`${label} folder dedupe`, err?.message || err);
  }
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
  // Album index is in Postgres: every worker already sees the latest rows.
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
        code: 'PHOTO_ALBUMS_USB_REQUIRED',
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
      code: 'PHOTO_ALBUMS_STORAGE_TYPE_REQUIRED'
    });
    return null;
  }

  const session = usbSession || oneDriveSession;
  if (!session) {
    res.status(428).json({
      error: 'Record Vault storage not unlocked',
      code: 'PHOTO_ALBUMS_USB_REQUIRED'
    });
    return null;
  }
  return session;
}

async function resolveVaultUnlockKey(singlesId, storageType, mountPathHint = null) {
  const iconName = await readPhotoAlbumsCacheIcon(singlesId, storageType);
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

/**
 * TutaDrive album vaults live under LARGE_CHEAP_STORAGE_FOLDER. After that folder moves
 * the absolute mount persisted in vault_cluster_state can still point at the old copy;
 * reopening it there would read/write the wrong disk.
 */
async function isCurrentTutaDriveAlbumsMount(singlesId, mountPath) {
  if (!isLeftSideTutaDrive()) return true;
  try {
    const memberId = await loadMemberIdForSingles(singlesId);
    if (!memberId) return false;
    return path.resolve(tutaDrivePhotoAlbumsMountPath(memberId)) === path.resolve(mountPath);
  } catch {
    return false;
  }
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
  if (normalizedType === 'onedrive' && !(await isCurrentTutaDriveAlbumsMount(id, mountPath))) {
    rvCloudWarn('Vault', 'cluster rehydrate skipped: stale TutaDrive mount path', {
      singlesId: id,
      mountPath
    });
    return null;
  }

  const key = await resolveVaultUnlockKey(id, normalizedType, mountPath);
  try {
    await unlockVaultUsbWithKey(id, mountPath, key, {
      skipBackup: normalizedType === 'onedrive' || !cluster.backupMountPath,
      backupMountPath: cluster.backupMountPath || null,
      storageType: normalizedType,
      skipClusterRegister: true,
      iconName: await readPhotoAlbumsCacheIcon(id, normalizedType)
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
 * Create the vault folder (vault.meta.json + photos/ + files/). The album index itself is
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
      throw new Error('Cannot create TutaPhotoAlbums in this folder (read-only or missing).');
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
        console.warn('[photoAlbumsUsb] could not rename imported vault db', abs, err?.message || err);
      }
    }
  }
}

/**
 * Make sure the member's album index for this vault folder is in Postgres.
 * - index present for this vaultId → use it (a stale vault.db next to it is renamed, not imported)
 * - vault.db present otherwise → import it (replaces any older index)
 * - nothing anywhere → create an empty index (`created: true`, caller seeds the sample album)
 */
async function ensureVaultIndexInPostgres({ singlesId, mountPath, meta, unlockKeys, defaultKey, retried = false }) {
  const vaultId = meta?.vaultId ? String(meta.vaultId) : null;
  const existing = await loadPhotoAlbumsMemberVault(singlesId);
  const legacyPaths = listLegacyVaultDbPaths(mountPath, meta);

  if (existing && (existing.vault_id === vaultId || !legacyPaths.length)) {
    if (vaultId && existing.vault_id !== vaultId) {
      console.warn('[photoAlbumsUsb] vault folder id changed; keeping the Postgres album index', {
        singlesId,
        previousVaultId: existing.vault_id,
        vaultId
      });
      await setPhotoAlbumsMemberVaultId(singlesId, vaultId);
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
          console.info('[photoAlbumsUsb] imported vault.db into Postgres', { singlesId, dbPath, counts });
        } finally {
          sqliteDb.close();
        }
        retireLegacyVaultDbFiles(legacyPaths);
        return { effectiveKey: tryKey, created: false, imported: true };
      }
    }
    throw openErr || new Error('Vault database is missing or unreadable');
  }

  await new VaultPgDb(singlesId).tx((tx) => createPhotoAlbumsMemberVault(tx, { vaultId, source: 'seed' }));
  return { effectiveKey: defaultKey, created: true, imported: false };
}

/**
 * Bulk migration (no session): import the legacy vault.db in a vault folder into Postgres.
 * `key` is the vault's unlock key (null for plaintext vaults). Folders without vault.db are skipped.
 */
export async function importLegacyPhotoAlbumsVaultDb(singlesId, mountPath, key = null) {
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
  if (targetStorageType === 'usb') {
    throw new Error('TutaPhotoAlbums on USB is retired. Use TutaCloud.');
  }
  ensureVaultLayoutDirs(mountPath);
  const check = validateVaultOnMount(mountPath, { requireDbFile: false });
  if (!check.ok) {
    throw new Error(check.error || 'Invalid vault folder');
  }
  const meta = readVaultMeta(mountPath);
  if (Number(meta?.version) === 1) {
    throw new Error(
      'This vault uses the retired 6-digit PIN format. Create a new vault in a different folder.'
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
  let didSeedNewMemberSample = false;
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
    didSeedNewMemberSample = await seedPhotoAlbumsNewMemberSampleDb(db);
  } catch (err) {
    if (err?.name === 'PhotoAlbumsUnlockError') throw err;
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
      // Rehydrate must never log the member off cluster-wide.
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
  if (didSeedNewMemberSample) {
    await seedPhotoAlbumsNewMemberSampleMedia({
      mountPath: session.mountPath,
      key: session.key,
      meta: session.meta,
      db: session.db
    });
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
  const sampleLabelMigrate = await migrateSampleAlbumTutorialLabelsDb(session.db);
  if (sampleLabelMigrate.migrated) {
    console.info(
      `[unlockVaultUsbWithKey] removed SAMPLE ALBUM tutorial labels singles_id=${singlesId} note_id=${sampleLabelMigrate.noteId}`
    );
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

  // Session file counts live on Postgres (website). Bridge standalone no-ops; FE reports instead.
  // Do not reset on cluster rehydrate, or when the other vault pane is already unlocked.
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

  await runFolderDedupe(session, '[unlockVaultUsbWithKey]');

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

/** Album index writes commit to Postgres immediately; nothing to flush. */
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
  'attachment_id, note_id, file_name, file_extension, file_size_bytes, checksum, mime_type, display_order, album_photo_seq, source_taken_at_ms, created_at';
const ATTACHMENT_COLUMNS_WITH_PATH = `${ATTACHMENT_COLUMNS}, relative_path`;

function mapAttachmentRow(row) {
  const seqFromDb =
    row.album_photo_seq != null && Number.isFinite(Number(row.album_photo_seq))
      ? Number(row.album_photo_seq)
      : null;
  const seqFromPath = parseAlbumPhotoSeqFromAttRelativePath(row.relative_path);
  const albumPhotoSeq =
    seqFromDb != null && seqFromDb >= 1 ? seqFromDb : seqFromPath != null && seqFromPath >= 1 ? seqFromPath : null;
  return {
    attachment_id: Number(row.attachment_id),
    note_id: Number(row.note_id),
    file_name: row.file_name,
    file_extension: row.file_extension,
    file_size_bytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : 0,
    checksum: row.checksum ? String(row.checksum) : null,
    mime_type: row.mime_type || null,
    display_order: Number(row.display_order ?? 0),
    album_photo_seq: albumPhotoSeq,
    source_taken_at_ms:
      row.source_taken_at_ms != null && Number.isFinite(Number(row.source_taken_at_ms))
        ? Number(row.source_taken_at_ms)
        : null,
    created_at: row.created_at
  };
}

/** Next permanent album photo seq for a note (1-based). */
async function nextAlbumPhotoSeqForNote(db, noteId) {
  const row = await db.one(
    `SELECT COALESCE(MAX(album_photo_seq), 0) + 1 AS next_seq
       FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, noteId]
  );
  const n = Number(row?.next_seq);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

async function nextAttachmentDisplayOrder(db, noteId) {
  const row = await db.one(
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
       FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2`,
    [db.singlesId, noteId]
  );
  return Number(row?.next_order ?? 0);
}

async function loadAttachmentRow(db, attachmentId) {
  return db.one(
    `SELECT ${ATTACHMENT_COLUMNS_WITH_PATH} FROM ${T.attachments} WHERE singles_id = $1 AND attachment_id = $2`,
    [db.singlesId, attachmentId]
  );
}

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
export async function vaultDedupeNoteAttachments(session, noteId) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return { removedAttachmentIds: [], kept: 0 };
  const db = session.db;

  const rows = await db.all(
    `SELECT ${ATTACHMENT_COLUMNS_WITH_PATH}
       FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL
      ORDER BY attachment_id ASC`,
    [db.singlesId, id]
  );
  if (rows.length < 2) {
    await runFolderDedupe(session, '[vaultDedupeNoteAttachments]');
    return { removedAttachmentIds: [], kept: rows.length };
  }

  const resolved = [];
  const checksumUpdates = [];
  for (const row of rows) {
    let checksum = row.checksum ? String(row.checksum).toLowerCase() : '';
    let sizeBytes = row.file_size_bytes != null ? Number(row.file_size_bytes) : 0;
    if (!checksum || !Number.isFinite(sizeBytes) || sizeBytes < 1) {
      try {
        const buffer = row.relative_path ? readEncryptedVaultFile(session, row.relative_path) : null;
        if (buffer?.length) {
          sizeBytes = buffer.length;
          checksum = crypto.createHash('sha256').update(buffer).digest('hex');
          checksumUpdates.push({ attachmentId: Number(row.attachment_id), sizeBytes, checksum });
        }
      } catch {
        // skip unreadable
      }
    }
    resolved.push({
      ...row,
      attachment_id: Number(row.attachment_id),
      file_size_bytes: sizeBytes,
      checksum: checksum || null
    });
  }

  const byKey = new Map();
  for (const row of resolved) {
    if (!row.checksum || !Number.isFinite(row.file_size_bytes) || row.file_size_bytes < 1) continue;
    const key = `${row.file_size_bytes}:${row.checksum}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const dupes = [];
  for (const group of byKey.values()) {
    if (group.length >= 2) dupes.push(...group.slice(1));
  }

  const removedAttachmentIds = [];
  if (checksumUpdates.length || dupes.length) {
    await db.tx(async (tx) => {
      for (const upd of checksumUpdates) {
        await tx.run(
          `UPDATE ${T.attachments} SET file_size_bytes = $3, checksum = $4
            WHERE singles_id = $1 AND attachment_id = $2`,
          [tx.singlesId, upd.attachmentId, upd.sizeBytes, upd.checksum]
        );
      }
      for (const dupe of dupes) {
        const changed = await tx.run(
          `UPDATE ${T.attachments} SET deleted_at = NOW()
            WHERE singles_id = $1 AND attachment_id = $2 AND deleted_at IS NULL`,
          [tx.singlesId, dupe.attachment_id]
        );
        if (changed) removedAttachmentIds.push(dupe.attachment_id);
      }
      if (removedAttachmentIds.length) await refreshNoteSearchText(tx, id);
    });
  }
  for (const dupe of dupes) {
    if (!removedAttachmentIds.includes(dupe.attachment_id) || !dupe.relative_path) continue;
    try {
      deleteEncryptedVaultFile(session, dupe.relative_path);
      deleteAttachmentVariants(session, dupe.relative_path);
    } catch {
      // ignore missing file
    }
  }

  await runFolderDedupe(session, '[vaultDedupeNoteAttachments]');

  return {
    removedAttachmentIds,
    kept: rows.length - removedAttachmentIds.length
  };
}

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

function mapNoteRowMetadata(row, albumMediaCount = 0) {
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
    album_media_count: Number(albumMediaCount) || 0,
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
  // Display path: purge size+checksum duplicate attachments + ENV folder hard dupes.
  try {
    await vaultDedupeNoteAttachments(session, noteId);
  } catch (err) {
    console.error('[vaultGetNote] attachment dedupe', err?.message || err);
  }
  return mapNote(session.db, noteId);
}

/** Notebook/note sidebar tree — metadata only; no body_text, keywords, attachments, or extra_images. */
export async function vaultGetTree(session) {
  const db = session.db;
  const sid = db.singlesId;
  const [notebooks, notes, mediaRows, shortcutRows] = await Promise.all([
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
      `SELECT note_id, file_extension FROM ${T.attachments} WHERE singles_id = $1 AND deleted_at IS NULL`,
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
  const albumMediaCountByNoteId = countPhotoAlbumsAlbumMediaByNoteId(mediaRows);
  for (const row of notes) {
    const notebookId = Number(row.notebook_id);
    if (!notesByNotebook.has(notebookId)) notesByNotebook.set(notebookId, []);
    notesByNotebook
      .get(notebookId)
      .push(mapNoteRowMetadata(row, albumMediaCountByNoteId.get(Number(row.note_id)) || 0));
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
    if (evaluateChain(chain, (term) => noteMatchesPhotoAlbumsSearchTerm(note, row.notebook_name, term))) {
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
    const normalized = normalizePhotoAlbumsKeyword(keyword);
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
    `SELECT relative_path FROM ${T.attachments} WHERE singles_id = $1 AND note_id = $2`,
    [sid, noteId]
  );
  for (const att of attachmentRows) {
    if (!att.relative_path) continue;
    deleteEncryptedVaultFile(session, att.relative_path);
    deleteAttachmentVariants(session, att.relative_path);
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

/**
 * Backfill album_photo_seq for rows that lack it (does not rename on-disk files).
 * Upload assigns seq + att_{id}_{seq}.* at insert time.
 */
export async function vaultReconcileAlbumPhotoSeq(session, noteId) {
  const id = Number(noteId);
  if (!session?.db || !Number.isFinite(id) || id < 1) return [];
  await session.db.tx(async (tx) => {
    const rows = await tx.all(
      `SELECT attachment_id, source_taken_at_ms, file_name, relative_path, album_photo_seq
         FROM ${T.attachments}
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL
        ORDER BY COALESCE(source_taken_at_ms, 0) ASC, lower(file_name) ASC, attachment_id ASC`,
      [tx.singlesId, id]
    );
    const seqOf = (row) => {
      const fromDb = Number(row.album_photo_seq);
      if (row.album_photo_seq != null && Number.isFinite(fromDb) && fromDb >= 1) return { seq: fromDb, fromDb: true };
      const fromPath = parseAlbumPhotoSeqFromAttRelativePath(row.relative_path);
      if (Number.isFinite(fromPath) && fromPath >= 1) return { seq: fromPath, fromDb: false };
      return null;
    };
    let maxSeq = rows.reduce((m, row) => Math.max(m, seqOf(row)?.seq || 0), 0);
    for (const row of rows) {
      const known = seqOf(row);
      if (known?.fromDb) continue;
      const seq = known ? known.seq : (maxSeq += 1);
      await tx.run(
        `UPDATE ${T.attachments} SET album_photo_seq = $3 WHERE singles_id = $1 AND attachment_id = $2`,
        [tx.singlesId, row.attachment_id, seq]
      );
    }
  });
  return loadAttachmentsForNote(session.db, id);
}

/**
 * Repair attachments stored before their format could be decoded (HEIC/HEIF/BMP):
 * rebuild missing _1000px/_thumbnail siblings and re-encode full files that no
 * browser can render. Safe to re-run; already-complete attachments are skipped.
 */
export async function vaultRepairMissingAttachmentVariants(session, noteId) {
  const id = Number(noteId);
  if (!session?.db || !Number.isFinite(id) || id < 1) return { repaired: 0, failed: 0 };
  const db = session.db;
  const note = await loadNote(db, id);
  if (!note) throw new Error('Note not found');

  const rows = await db.all(
    `SELECT attachment_id, file_name, file_extension, relative_path, album_photo_seq
       FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL`,
    [db.singlesId, id]
  );

  let repaired = 0;
  let failed = 0;

  for (const row of rows) {
    const cleanExt = String(row.file_extension || '').replace(/^\./, '').toLowerCase();
    if (!row.relative_path || !isPhotoAlbumsRasterImageExtension(cleanExt)) continue;

    const needsJpegFull = photoAlbumsExtensionRequiresJpegFullFile(cleanExt);
    const hasDisplay = !!readEncryptedVaultFile(
      session,
      fileRelativePathForVariant(row.relative_path, 'display')
    )?.length;
    const hasThumb = !!readEncryptedVaultFile(
      session,
      fileRelativePathForVariant(row.relative_path, 'thumb')
    )?.length;
    if (hasDisplay && hasThumb && (!needsJpegFull || isBundledInitializeSampleAttachmentId(row.attachment_id))) {
      continue;
    }

    try {
      const original = readEncryptedVaultFile(session, row.relative_path);
      if (!original?.length) continue;

      let workingBuffer = original;
      let relativePath = row.relative_path;
      let variantExt = cleanExt;

      if (needsJpegFull) {
        const normalized = await normalizePhotoAlbumsAttachmentBuffer(original, {
          forceJpeg: true,
          ext: cleanExt
        });
        workingBuffer = normalized.buffer;
        variantExt = 'jpg';
        relativePath = fileRelativePath(note.notebook_id, id, row.attachment_id, 'jpg', row.album_photo_seq);
        const safeName = `${String(row.file_name || 'photo').replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
        writeEncryptedVaultFile(session, relativePath, workingBuffer);
        await db.run(
          `UPDATE ${T.attachments}
              SET relative_path = $3, file_extension = 'jpg', mime_type = 'image/jpeg', file_name = $4,
                  file_size_bytes = $5, checksum = $6
            WHERE singles_id = $1 AND attachment_id = $2`,
          [
            db.singlesId,
            row.attachment_id,
            relativePath,
            safeName,
            workingBuffer.length,
            crypto.createHash('sha256').update(workingBuffer).digest('hex')
          ]
        );
        if (relativePath !== row.relative_path) {
          deleteEncryptedVaultFile(session, row.relative_path);
          deleteEncryptedVaultFile(session, fileRelativePathForVariant(row.relative_path, 'display'));
          deleteEncryptedVaultFile(session, fileRelativePathForVariant(row.relative_path, 'thumb'));
        }
      }

      const displayBuf = await buildPhotoAlbumsDisplay1000pxBuffer(workingBuffer, variantExt);
      const thumbBuf = await buildPhotoAlbumsThumbnailBuffer(workingBuffer, variantExt);
      writeEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'display'), displayBuf);
      writeEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'thumb'), thumbBuf);
      repaired += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        `[vaultRepairMissingAttachmentVariants] attachment ${row.attachment_id}:`,
        err?.message || err
      );
    }
  }

  return { repaired, failed };
}

/**
 * Free-tier quota counters: how many image / video attachments this account
 * currently keeps across every album. Counts live attachments only, so deleting
 * media frees quota back up.
 *
 * @returns {Promise<{ imageCount: number, videoCount: number }>}
 */
export async function vaultCountAccountMedia(session) {
  const rows = await session.db.all(
    `SELECT file_extension, COUNT(*)::int AS n
       FROM ${T.attachments}
      WHERE singles_id = $1 AND deleted_at IS NULL
      GROUP BY file_extension`,
    [session.db.singlesId]
  );
  let imageCount = 0;
  let videoCount = 0;
  for (const row of rows) {
    const n = Number(row?.n) || 0;
    if (isPhotoAlbumsStagingVideoExtension(row?.file_extension)) videoCount += n;
    else if (isPhotoAlbumsStagingPhotoExtension(row?.file_extension)) imageCount += n;
  }
  return { imageCount, videoCount };
}

export async function vaultAddNoteAttachment(session, noteId, { buffer, fileName, ext, mimeType, sourceTakenAtMs }) {
  const db = session.db;
  const row = await loadNote(db, noteId);
  if (!row) throw new Error('Note not found');
  if (!buffer?.length) throw new Error('File is empty');

  let workingBuffer = buffer;
  let cleanExt = String(ext || 'bin').replace(/^\./, '').toLowerCase();
  let resolvedMime = mimeType || mimeTypeForPhotoAlbumsExtension(cleanExt);
  let safeName =
    String(fileName || `file.${cleanExt}`)
      .trim()
      .slice(0, 240) || `file.${cleanExt}`;

  // Photos >1MB → ~0.5MB JPEG full file; always emit _1000px + _thumbnail siblings.
  let writeVariants = false;
  if (isPhotoAlbumsRasterImageExtension(cleanExt)) {
    try {
      const normalized = await normalizePhotoAlbumsAttachmentBuffer(workingBuffer, {
        forceJpeg: photoAlbumsExtensionRequiresJpegFullFile(cleanExt),
        ext: cleanExt
      });
      if (normalized.changed) {
        workingBuffer = normalized.buffer;
        cleanExt = 'jpg';
        resolvedMime = 'image/jpeg';
        const base = String(safeName).replace(/\.[^.]+$/, '');
        safeName = `${base || 'photo'}.jpg`;
      }
      writeVariants = true;
    } catch (err) {
      console.warn('[vaultAddNoteAttachment] normalize skipped:', err?.message || err);
      writeVariants = isPhotoAlbumsRasterImageExtension(cleanExt);
    }
  } else if (isPhotoAlbumsStagingVideoExtension(cleanExt)) {
    try {
      const normalized = await normalizePhotoAlbumsVideoBuffer(workingBuffer, { ext: cleanExt });
      if (normalized.changed) {
        workingBuffer = normalized.buffer;
        cleanExt = normalized.ext || 'mp4';
        resolvedMime = normalized.mimeType || 'video/mp4';
        const base = String(safeName).replace(/\.[^.]+$/, '');
        safeName = `${base || 'video'}.${cleanExt}`;
      }
    } catch (err) {
      console.warn('[vaultAddNoteAttachment] video normalize skipped:', err?.message || err);
    }
  }

  const checksum = crypto.createHash('sha256').update(workingBuffer).digest('hex');
  const sizeBytes = workingBuffer.length;

  // Duplicate shortcut: same byte size → confirm with checksum. Reuse existing row.
  const sameSizeRows = await db.all(
    `SELECT ${ATTACHMENT_COLUMNS_WITH_PATH}
       FROM ${T.attachments}
      WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL AND file_size_bytes = $3`,
    [db.singlesId, noteId, sizeBytes]
  );
  for (const candidate of sameSizeRows) {
    let candidateChecksum = candidate.checksum ? String(candidate.checksum) : '';
    if (!candidateChecksum && candidate.relative_path) {
      try {
        const existingBuf = readEncryptedVaultFile(session, candidate.relative_path);
        if (existingBuf?.length === sizeBytes) {
          candidateChecksum = crypto.createHash('sha256').update(existingBuf).digest('hex');
          await db.run(
            `UPDATE ${T.attachments} SET checksum = $3 WHERE singles_id = $1 AND attachment_id = $2`,
            [db.singlesId, candidate.attachment_id, candidateChecksum]
          );
        }
      } catch {
        // ignore
      }
    }
    if (candidateChecksum && candidateChecksum === checksum) {
      try {
        await vaultDedupeNoteAttachments(session, noteId);
      } catch (err) {
        console.error('[vaultAddNoteAttachment] note dedupe', err?.message || err);
      }
      return { ...mapAttachmentRow(candidate), duplicate: true };
    }
  }

  const takenMs =
    Number.isFinite(Number(sourceTakenAtMs)) && Number(sourceTakenAtMs) > 0
      ? Math.round(Number(sourceTakenAtMs))
      : Date.now();
  const { attachmentId, relativePath } = await db.tx(async (tx) => {
    const displayOrder = await nextAttachmentDisplayOrder(tx, noteId);
    const albumPhotoSeq = await nextAlbumPhotoSeqForNote(tx, noteId);
    // Ids at or below the sample floor stay reserved for Restore Sample Album.
    const id = await tx.nextId('attachments', { floor: sampleAttachmentIdFloor() });
    const rel = fileRelativePath(row.notebook_id, noteId, id, cleanExt, albumPhotoSeq);
    await tx.run(
      `INSERT INTO ${T.attachments}
         (singles_id, attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes,
          checksum, mime_type, display_order, source_taken_at_ms, album_photo_seq)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tx.singlesId,
        id,
        noteId,
        safeName,
        cleanExt,
        rel,
        sizeBytes,
        checksum,
        resolvedMime,
        displayOrder,
        takenMs,
        albumPhotoSeq
      ]
    );
    writeEncryptedVaultFile(session, rel, workingBuffer);
    await refreshNoteSearchText(tx, noteId);
    return { attachmentId: id, relativePath: rel };
  });

  if (writeVariants) {
    try {
      const displayBuf = await buildPhotoAlbumsDisplay1000pxBuffer(workingBuffer, cleanExt);
      const thumbBuf = await buildPhotoAlbumsThumbnailBuffer(workingBuffer, cleanExt);
      writeEncryptedVaultFile(
        session,
        fileRelativePathForVariant(relativePath, 'display'),
        displayBuf
      );
      writeEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'thumb'), thumbBuf);
    } catch (err) {
      console.warn('[vaultAddNoteAttachment] variant write failed:', err?.message || err);
    }
  } else if (isPhotoAlbumsStagingVideoExtension(cleanExt)) {
    try {
      const poster = await buildPhotoAlbumsVideoPosterThumbnailBuffer(workingBuffer, { ext: cleanExt });
      if (poster?.length) {
        writeEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'thumb'), poster);
      }
    } catch (err) {
      console.warn('[vaultAddNoteAttachment] video poster failed:', err?.message || err);
    }
  }

  try {
    await vaultDedupeNoteAttachments(session, noteId);
  } catch (err) {
    console.error('[vaultAddNoteAttachment] note dedupe', err?.message || err);
  }
  return mapAttachmentRow(await loadAttachmentRow(db, attachmentId));
}

function deleteAttachmentVariants(session, relativePath) {
  if (!relativePath) return;
  deleteEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'display'));
  deleteEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'thumb'));
}

/** Restore Sample Album: SAMPLE SET / SAMPLE ALBUM + bundled photos (same seed as a new member). */
export async function vaultRestoreSampleAlbum(session) {
  const result = await restorePhotoAlbumsSampleAlbumDb(session.db);
  if (result.restoredAttachmentIds.length) {
    await linkInitializeSampleIntoVault({
      mountPath: session.mountPath,
      key: session.key,
      meta: session.meta,
      db: session.db,
      onlyAttachmentIds: result.restoredAttachmentIds,
      attachmentIdMap: result.attachmentIdMap
    });
  }
  await session.db.tx((tx) => refreshNoteSearchText(tx, result.noteId));
  return { success: true, ...result };
}

export async function vaultDeleteNoteAttachment(session, noteId, attachmentId) {
  const db = session.db;
  const row = await db.one(
    `SELECT attachment_id, relative_path FROM ${T.attachments}
      WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [db.singlesId, attachmentId, noteId]
  );
  if (!row) throw new Error('Attachment not found');
  await db.tx(async (tx) => {
    await tx.run(
      `UPDATE ${T.attachments} SET deleted_at = NOW() WHERE singles_id = $1 AND attachment_id = $2`,
      [tx.singlesId, attachmentId]
    );
    await refreshNoteSearchText(tx, noteId);
  });
  deleteEncryptedVaultFile(session, row.relative_path);
  deleteAttachmentVariants(session, row.relative_path);
  return { success: true, attachment_id: Number(attachmentId) };
}

/**
 * Copy or move one album photo/video into another album. The destination gets a new
 * attachment row (its own photo seq + file path) that is not placed on any page, so it
 * shows in that album's Green Tray. Move then deletes the source attachment.
 * If the destination already holds the same file (checksum), that row is reused.
 * @returns {Promise<{ success: true, mode: 'copy'|'move', attachment: object, duplicate: boolean }>}
 */
export async function vaultTransferNoteAttachment(session, noteId, attachmentId, targetNoteId, mode = 'copy') {
  const transferMode = mode === 'move' ? 'move' : 'copy';
  const sourceNoteId = Number(noteId);
  const destNoteId = Number(targetNoteId);
  if (sourceNoteId === destNoteId) throw new Error('Choose a different album');
  const db = session.db;
  const target = await loadNote(db, destNoteId);
  if (!target) throw new Error('Note not found');
  const src = await db.one(
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type, source_taken_at_ms
       FROM ${T.attachments}
      WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [db.singlesId, attachmentId, sourceNoteId]
  );
  if (!src) throw new Error('Attachment not found');

  const fullBuf = readVaultFileOrNull(session, src.relative_path);
  if (!fullBuf?.length) throw new Error('Photo file is missing');
  const checksum = src.checksum
    ? String(src.checksum)
    : crypto.createHash('sha256').update(fullBuf).digest('hex');
  const ext = String(src.file_extension || 'bin').replace(/^\./, '').toLowerCase();

  const { destId, duplicate, relativePath } = await db.tx(async (tx) => {
    const existing = await tx.one(
      `SELECT attachment_id FROM ${T.attachments}
        WHERE singles_id = $1 AND note_id = $2 AND deleted_at IS NULL AND checksum = $3
        ORDER BY attachment_id LIMIT 1`,
      [tx.singlesId, destNoteId, checksum]
    );
    if (existing) return { destId: Number(existing.attachment_id), duplicate: true, relativePath: null };
    const albumPhotoSeq = await nextAlbumPhotoSeqForNote(tx, destNoteId);
    const displayOrder = await nextAttachmentDisplayOrder(tx, destNoteId);
    const id = await tx.nextId('attachments', { floor: sampleAttachmentIdFloor() });
    const rel = fileRelativePath(target.notebook_id, destNoteId, id, ext, albumPhotoSeq);
    await tx.run(
      `INSERT INTO ${T.attachments}
         (singles_id, attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes,
          checksum, mime_type, display_order, source_taken_at_ms, album_photo_seq)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tx.singlesId,
        id,
        destNoteId,
        src.file_name,
        ext,
        rel,
        fullBuf.length,
        checksum,
        src.mime_type || mimeTypeForPhotoAlbumsExtension(ext),
        displayOrder,
        src.source_taken_at_ms ?? Date.now(),
        albumPhotoSeq
      ]
    );
    writeEncryptedVaultFile(session, rel, fullBuf);
    await refreshNoteSearchText(tx, destNoteId);
    return { destId: id, duplicate: false, relativePath: rel };
  });

  if (!duplicate) {
    for (const variant of ['display', 'thumb']) {
      let buf = readVaultFileOrNull(session, fileRelativePathForVariant(src.relative_path, variant));
      if (!buf && isPhotoAlbumsRasterImageExtension(ext)) {
        try {
          buf =
            variant === 'display'
              ? await buildPhotoAlbumsDisplay1000pxBuffer(fullBuf, ext)
              : await buildPhotoAlbumsThumbnailBuffer(fullBuf, ext);
        } catch (err) {
          console.warn('[vaultTransferNoteAttachment] variant build failed:', err?.message || err);
        }
      }
      if (buf?.length) writeEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, variant), buf);
    }
  }

  if (transferMode === 'move') {
    await db.tx(async (tx) => {
      await tx.run(
        `UPDATE ${T.attachments} SET deleted_at = NOW() WHERE singles_id = $1 AND attachment_id = $2`,
        [tx.singlesId, src.attachment_id]
      );
      await refreshNoteSearchText(tx, sourceNoteId);
    });
    deleteEncryptedVaultFile(session, src.relative_path);
    deleteAttachmentVariants(session, src.relative_path);
  }

  const attachment = mapAttachmentRow(await loadAttachmentRow(db, destId));
  return { success: true, mode: transferMode, attachment, duplicate };
}

function readVaultFileOrNull(session, relativePath) {
  try {
    const buf = readEncryptedVaultFile(session, relativePath);
    return buf?.length ? buf : null;
  } catch {
    return null;
  }
}

/** Thumbs are always JPEG; a write cut short lacks the EOI marker. */
function isCompleteJpeg(buf) {
  return (
    Buffer.isBuffer(buf) &&
    buf.length > 4 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[buf.length - 2] === 0xff &&
    buf[buf.length - 1] === 0xd9
  );
}

/** session → Map<attachmentId, Promise<boolean>>; dedupes concurrent rebuilds of one thumb. */
const thumbnailRebuildsInFlight = new WeakMap();

async function rebuildAttachmentThumbnail(session, row, thumbRel) {
  const ext = String(row.file_extension || '').replace(/^\./, '').toLowerCase();
  let thumb = null;
  if (isPhotoAlbumsRasterImageExtension(ext)) {
    const display = readVaultFileOrNull(session, fileRelativePathForVariant(row.relative_path, 'display'));
    const source = display || readVaultFileOrNull(session, row.relative_path);
    if (!source) return false;
    thumb = await buildPhotoAlbumsThumbnailBuffer(source, display ? 'jpg' : ext);
  } else if (isPhotoAlbumsStagingVideoExtension(ext)) {
    const source = readVaultFileOrNull(session, row.relative_path);
    if (!source) return false;
    thumb = await buildPhotoAlbumsVideoPosterThumbnailBuffer(source, { ext });
  }
  if (!thumb?.length) return false;
  writeEncryptedVaultFile(session, thumbRel, thumb);
  return true;
}

/**
 * Make sure `att_*_thumbnail.jpg` exists (and decrypts) for a photo or video attachment,
 * rebuilding it from the display/full file when missing or corrupt. Never throws.
 * @returns {Promise<boolean>} true when a usable thumbnail is on disk afterwards.
 */
export async function vaultEnsureNoteAttachmentThumbnail(session, noteId, attachmentId) {
  if (!session?.db) return false;
  let row;
  try {
    row = await session.db.one(
      `SELECT attachment_id, file_extension, relative_path
         FROM ${T.attachments}
        WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
      [session.db.singlesId, attachmentId, noteId]
    );
  } catch (err) {
    console.warn('[vaultEnsureNoteAttachmentThumbnail] lookup failed:', err?.message || err);
    return false;
  }
  if (!row?.relative_path) return false;
  const thumbRel = fileRelativePathForVariant(row.relative_path, 'thumb');
  if (!thumbRel || thumbRel === row.relative_path) return false;
  if (isCompleteJpeg(readVaultFileOrNull(session, thumbRel))) return true;

  let inflight = thumbnailRebuildsInFlight.get(session);
  if (!inflight) {
    inflight = new Map();
    thumbnailRebuildsInFlight.set(session, inflight);
  }
  const key = Number(row.attachment_id);
  if (!inflight.has(key)) {
    inflight.set(
      key,
      rebuildAttachmentThumbnail(session, row, thumbRel)
        .catch((err) => {
          console.warn(`[vaultEnsureNoteAttachmentThumbnail] attachment ${key}:`, err?.message || err);
          return false;
        })
        .finally(() => inflight.delete(key))
    );
  }
  return inflight.get(key);
}

export async function vaultGetNoteAttachment(session, noteId, attachmentId, { variant: variantRaw } = {}) {
  const row = await session.db.one(
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, mime_type
       FROM ${T.attachments}
      WHERE singles_id = $1 AND attachment_id = $2 AND note_id = $3 AND deleted_at IS NULL`,
    [session.db.singlesId, attachmentId, noteId]
  );
  if (!row) return null;
  const variant = normalizeAttachmentVariant(variantRaw);
  const basePath = row.relative_path;
  let rel = basePath;
  if (variant === 'display' || variant === 'thumb') {
    const preferred = fileRelativePathForVariant(basePath, variant);
    const preferredBuf = readVaultFileOrNull(session, preferred);
    if (preferredBuf) {
      return {
        buffer: preferredBuf,
        fileName:
          variant === 'display'
            ? String(row.file_name || 'photo').replace(/\.[^.]+$/, '') + '_1000px.jpg'
            : String(row.file_name || 'photo').replace(/\.[^.]+$/, '') + '_thumbnail.jpg',
        fileExtension: 'jpg',
        contentType: 'image/jpeg',
        variant
      };
    }
    // Fallback: display missing → try thumb then full; thumb missing → full.
    if (variant === 'display') {
      const thumbPath = fileRelativePathForVariant(basePath, 'thumb');
      const thumbBuf = readVaultFileOrNull(session, thumbPath);
      if (thumbBuf) {
        return {
          buffer: thumbBuf,
          fileName: String(row.file_name || 'photo').replace(/\.[^.]+$/, '') + '_thumbnail.jpg',
          fileExtension: 'jpg',
          contentType: 'image/jpeg',
          variant: 'thumb'
        };
      }
    }
    rel = basePath;
  }
  const buffer = readEncryptedVaultFile(session, rel);
  if (!buffer) return null;
  const ext = String(row.file_extension || '').toLowerCase();
  return {
    buffer,
    fileName: row.file_name,
    fileExtension: ext,
    contentType: row.mime_type || mimeTypeForPhotoAlbumsExtension(ext),
    variant: 'full'
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

export function wipeVaultAtMountPath(mountPath, singlesId) {
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
  return { wiped: true };
}
