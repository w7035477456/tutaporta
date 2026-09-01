import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs from 'sql.js';
import {
  sealVaultBuffer,
  openVaultBuffer,
  isPlaintextVaultKey,
  isVaultPhotoAndDbEncryptionEnabled
} from './vaultCrypto.js';
import { removeDuplicateFilesInPhotoAlbumsEnvFolders } from '../photoAlbumsFolderDedupe.js';
import { loadPhotoAlbumsAlbumMediaCountByNoteId } from '../photoAlbumsSidebarMediaCount.js';
import {
  createIconVaultKeyMaterial,
  iconVaultKdfMetaFields,
  listIconVaultUnlockKeys,
  vaultMetaUsesArgon2idKdf
} from '../photoAlbumsIconKeys.js';
import { isVaultBackupUsbEnabled, isVaultCloudSyncEnabled } from '../photoAlbumsStorageFlags.js';
import { buildVaultFolderListing } from '../vaultFolderTreeListing.js';
import { vaultMetaUsesPlaintextStorage } from '../photoAlbumsIconEncryption.js';
import {
  fileRelativePath,
  parseAlbumPhotoSeqFromAttRelativePath,
  extraPhotoRelativePath,
  photoRelativePath,
  vaultDbPath,
  vaultFileStoragePath,
  vaultFileStorageRelativePath,
  vaultFilesRoot,
  vaultMetaPath,
  vaultPhotoStoragePath,
  vaultPhotoStorageRelativePath,
  vaultPhotosRoot,
  vaultRootOnMount,
  getVaultDbFileName,
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
import {
  DEFAULT_BODY_TEXT,
  NOTE_EXTRA_IMAGES_MIGRATION_SQL,
  VAULT_SCHEMA_SQL
} from './vaultSchema.js';

/** Prefix for FE inner-layer ciphertext stored in notes.body_text (Argon2id + AES-256-GCM). */
export const NOTE_INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

function noteColumnExists(db, columnName) {
  const rows = queryAll(db, `PRAGMA table_info(notes)`);
  return rows.some((row) => String(row.name || row.Name || '') === columnName);
}

function ensureNoteInnerEncryptColumns(db) {
  let changed = false;
  if (!noteColumnExists(db, 'inner_encrypt_enabled')) {
    db.run(`ALTER TABLE notes ADD COLUMN inner_encrypt_enabled INTEGER NOT NULL DEFAULT 0`);
    changed = true;
  }
  if (!noteColumnExists(db, 'inner_pin_salt')) {
    db.run(`ALTER TABLE notes ADD COLUMN inner_pin_salt TEXT`);
    changed = true;
  }
  if (!noteColumnExists(db, 'inner_unlock_locked_until')) {
    db.run(`ALTER TABLE notes ADD COLUMN inner_unlock_locked_until TEXT`);
    changed = true;
  }
  return changed;
}

function attachmentColumnExists(db, columnName) {
  const rows = queryAll(db, `PRAGMA table_info(note_attachments)`);
  return rows.some((row) => String(row.name || row.Name || '') === columnName);
}

function ensureAttachmentAlbumSeqColumns(db) {
  let changed = false;
  if (!attachmentColumnExists(db, 'album_photo_seq')) {
    db.run(`ALTER TABLE note_attachments ADD COLUMN album_photo_seq INTEGER`);
    changed = true;
  }
  if (!attachmentColumnExists(db, 'source_taken_at_ms')) {
    db.run(`ALTER TABLE note_attachments ADD COLUMN source_taken_at_ms INTEGER`);
    changed = true;
  }
  return changed;
}
import {
  seedPhotoAlbumsNewMemberSampleDb,
  seedPhotoAlbumsNewMemberSampleMedia
} from '../photoAlbumsNewMemberSample/seedPhotoAlbumsNewMemberSample.js';
import { migrateSampleAlbumTutorialLabelsDb } from '../photoAlbumsNewMemberSample/migrateSampleAlbumTutorialLabels.js';
import { readInitializeSampleVaultBuffer, isBundledInitializeSampleAttachmentId } from '../photoAlbumsNewMemberSample/initializeSampleMedia.js';
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
import { normalizePhotoAlbumsVideoBuffer } from '../photoAlbumsNormalizeVideo.js';
import {
  scheduleTrackedOneDriveUpload,
  uploadOneDriveVaultOnLogoff,
  ensureOneDriveVaultPhotoOnDisk,
  ensureOneDriveVaultFileOnDisk
} from '../photoAlbumsOneDrive/oneDriveVaultSync.js';
import { markOneDrivePathDirty, takeOneDriveDirtyPaths, clearAllOneDriveDirty } from '../photoAlbumsOneDrive/oneDriveVaultDirty.js';
import {
  registerVaultClusterUnlock,
  clearVaultClusterUnlock,
  getVaultClusterUnlock,
  isVaultMountPathPresent
} from '../photoAlbumsClusterSession.js';
import { readPhotoAlbumsCacheIcon } from '../photoAlbumsCacheIcon.js';
import { downloadVaultToStaging } from '../photoAlbumsOneDrive/oneDriveVaultSync.js';
import { oneDriveStagingMountPath } from '../photoAlbumsOneDriveStagingRoot.js';
import { flushVaultTransferBytes } from '../photoAlbumsTransferTracking.js';
import {
  addVaultSessionFileCounts,
  countVaultSessionNotebooksAndNotes,
  resetVaultSessionFileCounts,
  snapshotVaultSessionFileCountsToLast
} from '../photoAlbumsSessionFileCounts.js';
import { rvCloudWarn } from '../photoAlbumsCloudDebugLog.js';

let sqlJsPromise = null;

function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

/** @type {Map<string, VaultSession>} */
const sessionsByKey = new Map();

export const PHOTO_ALBUMS_STORAGE_HEADER = 'x-record-vault-storage';

export function normalizeVaultStorageType(raw, fallback = 'usb') {
  const value = String(raw ?? fallback).trim().toLowerCase();
  return value === 'onedrive' ? 'onedrive' : 'usb';
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

class VaultSession {
  constructor({ singlesId, mountPath, backupMountPath = null, db, key, meta }) {
    this.singlesId = singlesId;
    this.mountPath = mountPath;
    this.backupMountPath = backupMountPath ? path.resolve(backupMountPath) : null;
    this.db = db;
    this.key = key;
    this.meta = meta;
    this.dirty = false;
    this.locked = false;
    this.storageType = 'usb';
    this.driveSinglesId = null;
    this.driveFolderId = null;
    /** FE/BE: tree open already counted toward session ui/usb tx/rx. */
    this.sessionFileCountsTreeReported = false;
  }
}

function scheduleCloudRelativeSync(session, relativePath) {
  if (!isVaultCloudSyncEnabled()) return;
  if (!session?.driveSinglesId) return;
  if (session.storageType !== 'onedrive') return;
  void (async () => {
    await markOneDrivePathDirty(session.driveSinglesId, relativePath);
    await scheduleTrackedOneDriveUpload(session.driveSinglesId, session.mountPath, relativePath);
  })().catch((err) => {
    rvCloudWarn('OneDrive', 'background sync failed — path stays dirty for logoff retry', {
      relativePath,
      message: err?.message || String(err)
    });
  });
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

function vaultTableExists(db, tableName) {
  const row = queryOne(
    db,
    `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    [tableName]
  );
  return Boolean(row?.ok);
}

function ensureNoteExtraImagesTable(db) {
  if (vaultTableExists(db, 'note_extra_images')) return false;
  db.exec(NOTE_EXTRA_IMAGES_MIGRATION_SQL);
  return true;
}

function runSchema(db) {
  db.exec(VAULT_SCHEMA_SQL);
  ensureNoteExtraImagesTable(db);
  ensureNoteInnerEncryptColumns(db);
  ensureAttachmentAlbumSeqColumns(db);
}

function exportDb(db) {
  return Buffer.from(db.export());
}

function writeVaultDbToMirror(session, plainBuffer) {
  if (vaultMetaUsesPlaintextStorage(session.meta) && !isSqliteVaultDbBuffer(plainBuffer)) {
    throw new Error('Vault database export is not valid SQLite — aborting save');
  }
  const sealed = sealVaultBuffer(plainBuffer, session.key);
  writeToMirrorPaths(session, (mountPath) => {
    atomicWriteFileSync(vaultDbPath(mountPath, session.meta), sealed);
  });
}

/** Export in-memory DB to staging disk when dirty (logoff / pre-cloud-sync). */
export function forcePersistVaultDb(session) {
  cancelScheduledFlushDbToUsb(session);
  if (!session?.db || session.locked || !session.dirty) return;
  const plain = exportDb(session.db);
  writeVaultDbToMirror(session, plain);
  session.dirty = false;
}

export function flushDbToUsb(session) {
  if (!session || session.locked) return;
  if (!session.dirty) return;
  const plain = exportDb(session.db);
  writeVaultDbToMirror(session, plain);
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(session, getVaultDbFileName(session.meta));
  }
  session.dirty = false;
}

/**
 * Coalesce rapid vault DB writes (multi-image drop) so USB/OneDrive staging is not rewritten on every file.
 * Photo/attachment bytes still hit disk immediately via writeEncrypted*.
 */
function scheduleFlushDbToUsb(session, delayMs = null) {
  markDirty(session);
  if (!session) return;
  const waitMs =
    delayMs != null
      ? delayMs
      : session.storageType === 'onedrive'
        ? 800
        : 500;
  if (session._flushDbTimer) {
    clearTimeout(session._flushDbTimer);
  }
  session._flushDbTimer = setTimeout(() => {
    session._flushDbTimer = null;
    try {
      flushDbToUsb(session);
    } catch (err) {
      console.error('[scheduleFlushDbToUsb]', err?.message || err);
    }
  }, waitMs);
}

function cancelScheduledFlushDbToUsb(session) {
  if (!session?._flushDbTimer) return;
  clearTimeout(session._flushDbTimer);
  session._flushDbTimer = null;
}

function markDirty(session) {
  session.dirty = true;
}

export function writeEncryptedPhoto(session, relativePath, buffer) {
  const enc = sealVaultBuffer(buffer, session.key);
  writeToMirrorPaths(session, (mountPath) => {
    const abs = vaultPhotoStoragePath(mountPath, relativePath, session.meta);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, enc);
  });
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(
      session,
      `${VAULT_PHOTOS_DIR}/${vaultPhotoStorageRelativePath(relativePath, session.meta)}`
    );
  }
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
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(
      session,
      `${VAULT_PHOTOS_DIR}/${vaultPhotoStorageRelativePath(relativePath, session.meta)}`
    );
  }
}

export function writeEncryptedVaultFile(session, relativePath, buffer) {
  const enc = sealVaultBuffer(buffer, session.key);
  writeToMirrorPaths(session, (mountPath) => {
    const abs = vaultFileStoragePath(mountPath, relativePath, session.meta);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, enc);
  });
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(
      session,
      `${VAULT_FILES_DIR}/${vaultFileStorageRelativePath(relativePath, session.meta)}`
    );
  }
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
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(
      session,
      `${VAULT_FILES_DIR}/${vaultFileStorageRelativePath(relativePath, session.meta)}`
    );
  }
}

function refreshNoteSearchText(db, noteId) {
  const note = queryOne(
    db,
    `SELECT note_name, body_text, inner_encrypt_enabled FROM notes WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  if (!note) return;
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
  db.run(`UPDATE notes SET search_text = ?, updated_at = datetime('now') WHERE note_id = ?`, [searchText, noteId]);
}

function seedEmptyVault(db) {
  seedPhotoAlbumsNewMemberSampleDb(db);
}

async function openDbFromBuffer(buffer) {
  const SQL = await getSqlJs();
  const db = new SQL.Database(buffer);
  runSchema(db);
  ensureNoteExtraImagesTable(db);
  return db;
}

async function createFreshDb() {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  runSchema(db);
  seedEmptyVault(db);
  return db;
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

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
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
      error: 'X-Record-Vault-Storage header is required when both OneDrive and USB vaults are unlocked',
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
 * Re-seal vault.db + photos/ + files/ under a new AES key and write Argon2id kdf meta.
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
  session.dirty = true;
  flushDbToUsb(session);

  if (session.backupMountPath && isVaultMountPathPresent(session.backupMountPath)) {
    try {
      walkAndReseal(vaultPhotosRoot(session.backupMountPath));
      walkAndReseal(vaultFilesRoot(session.backupMountPath));
      fs.writeFileSync(
        vaultMetaPath(session.backupMountPath),
        JSON.stringify(session.meta, null, 2)
      );
      const sealedDb = sealVaultBuffer(exportDb(session.db), newKey);
      atomicWriteFileSync(vaultDbPath(session.backupMountPath, session.meta), sealedDb);
    } catch (err) {
      console.warn('[migrateSessionIconVaultToArgon2id] backup mirror failed', err?.message || err);
    }
  }

  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(session, getVaultDbFileName(session.meta));
    scheduleCloudRelativeSync(session, VAULT_META_FILE);
  }

  console.log('[migrateSessionIconVaultToArgon2id] upgraded vault icon KDF to Argon2id', {
    singlesId: session.singlesId,
    storageType: session.storageType,
    vaultId: session.meta?.vaultId
  });
  return true;
}

async function tryRehydrateVaultSession(singlesId, storageType) {
  const id = Number(singlesId);
  const normalizedType = normalizeVaultStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) return null;
  if (getVaultSession(id, normalizedType)) return getVaultSession(id, normalizedType);

  const cluster = await getVaultClusterUnlock(id, normalizedType);
  if (!cluster?.mountPath) return null;

  let mountPath = String(cluster.mountPath).trim();
  if (normalizedType === 'onedrive' && isVaultCloudSyncEnabled() && !isVaultMountPathPresent(mountPath)) {
    mountPath = oneDriveStagingMountPath(id);
  }
  if (!isVaultMountPathPresent(mountPath)) {
    if (normalizedType !== 'onedrive' || !isVaultCloudSyncEnabled()) {
      return null;
    }
    try {
      const staged = await downloadVaultToStaging(id);
      mountPath = staged.mountPath;
    } catch (err) {
      rvCloudWarn('Vault', 'cluster rehydrate failed — OneDrive staging unavailable', {
        singlesId: id,
        message: err?.message || String(err)
      });
      return null;
    }
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
  if (session && normalizedType === 'onedrive') {
    // TutaDrive borrows this slot. Tagging it with driveSinglesId would turn a
    // local-folder vault into a Microsoft-synced one on any rehydrate.
    if (isVaultCloudSyncEnabled()) {
      session.driveSinglesId = id;
      session.driveFolderId = cluster.driveFolderId || session.driveFolderId || null;
    } else {
      session.driveSinglesId = null;
      session.driveFolderId = null;
      session.tutaDrive = true;
      session.label = 'TutaDrive';
    }
  }
  return session;
}

export async function initializeVaultOnUsb(mountPath, iconName) {
  const material = await createIconVaultKeyMaterial(iconName);
  return initializeVaultOnUsbWithKey(mountPath, material.key, material);
}

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
      throw new Error(
        'Cannot create TutaPhotoAlbums on this volume (read-only or not a real USB). ' +
          'Eject the Record Vault USB Bridge installer DMG if it is open, then pick your USB drive (for example TutaPhotoAlbums).'
      );
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
  const db = await createFreshDb();
  await seedPhotoAlbumsNewMemberSampleMedia({ mountPath: normalized, key, meta, db });
  fs.writeFileSync(vaultDbPath(normalized), sealVaultBuffer(exportDb(db), key));
  db.close();
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

export async function unlockVaultUsbWithKey(singlesId, mountPath, key, options = {}) {
  const targetStorageType = normalizeVaultStorageType(options?.storageType, 'usb');
  ensureVaultLayoutDirs(mountPath);
  const check = validateVaultOnMount(mountPath);
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

  let db;
  let effectiveKey = null;
  let didSeedNewMemberSample = false;
  try {
    const dbCandidates = [];
    const primaryDb = resolveVaultDbPath(mountPath);
    dbCandidates.push(primaryDb);
    const metaForPaths = readVaultMeta(mountPath);
    for (const name of listVaultDbFileNamesForRead(metaForPaths)) {
      const abs = path.join(vaultRoot, name);
      if (!dbCandidates.includes(abs)) dbCandidates.push(abs);
    }
    let openErr = null;
    outer: for (const dbPath of dbCandidates) {
      if (!fs.existsSync(dbPath)) continue;
      const enc = fs.readFileSync(dbPath);
      for (const tryKey of unlockKeys) {
        try {
          const plain = openVaultBuffer(enc, tryKey);
          if (!isSqliteVaultDbBuffer(plain)) continue;
          db = await openDbFromBuffer(plain);
          effectiveKey = tryKey;
          openErr = null;
          break outer;
        } catch (err) {
          openErr = err;
        }
      }
    }
    if (!db) {
      throw openErr || new Error('Vault database is missing or unreadable');
    }
    didSeedNewMemberSample = seedPhotoAlbumsNewMemberSampleDb(db);
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
    await logoffVaultUsb(singlesId, targetStorageType);
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
    markDirty(session);
    flushDbToUsb(session);
  }
  if (!options?.skipClusterRegister) {
    await registerVaultClusterUnlock({
      singlesId,
      storageType: targetStorageType,
      mountPath: session.mountPath,
      backupMountPath: session.backupMountPath,
      driveFolderId: session.driveFolderId || null
    });
  }
  if (ensureNoteExtraImagesTable(session.db)) {
    markDirty(session);
    flushDbToUsb(session);
  }
  if (ensureNoteInnerEncryptColumns(session.db)) {
    markDirty(session);
    flushDbToUsb(session);
  }
  if (ensureAttachmentAlbumSeqColumns(session.db)) {
    markDirty(session);
    flushDbToUsb(session);
  }
  const sampleLabelMigrate = migrateSampleAlbumTutorialLabelsDb(session.db);
  if (sampleLabelMigrate.migrated) {
    markDirty(session);
    flushDbToUsb(session);
    console.info(
      `[unlockVaultUsbWithKey] migrated SAMPLE ALBUM tutorial labels singles_id=${singlesId} note_id=${sampleLabelMigrate.noteId}`
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
    openItemCount = countVaultSessionNotebooksAndNotes(session);
    if (openItemCount > 0) {
      await addVaultSessionFileCounts(session.singlesId, { usbDelta: openItemCount });
    }
  }

  try {
    removeDuplicateFilesInPhotoAlbumsEnvFolders({ session });
  } catch (err) {
    console.error('[unlockVaultUsbWithKey] folder dedupe', err?.message || err);
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
  let session = getVaultSession(id, normalizedType);
  if (!session) {
    // Round-robin: logoff may hit a node that never held the open SQLite session.
    session = await tryRehydrateVaultSession(id, normalizedType);
  }
  if (!session) {
    if (onProgress) await onProgress({ percent: 100, label: 'Done' });
    await clearVaultClusterUnlock(id, normalizedType);
    await flushVaultTransferBytes(id);
    // Freeze totals for login-gate display even when this node had no local session.
    await snapshotVaultSessionFileCountsToLast(id);
    return { success: true };
  }
  const dbDirty = Boolean(session.dirty);
  try {
    if (onProgress) {
      await onProgress({
        percent: 2,
        label:
          normalizedType === 'onedrive'
            ? 'Saving notes to OneDrive…'
            : 'Saving USB vault…'
      });
    }
    if (dbDirty) {
      if (onProgress && normalizedType !== 'onedrive') {
        await onProgress({ percent: 25, label: 'Saving USB vault' });
      }
      forcePersistVaultDb(session);
      if (normalizedType === 'usb') {
        await addVaultSessionFileCounts(id, { usbDelta: 1 });
      }
    }
    if (session.storageType === 'onedrive' && session.driveSinglesId) {
      const dirtyPaths = await takeOneDriveDirtyPaths(session.driveSinglesId);
      await uploadOneDriveVaultOnLogoff(session.driveSinglesId, session.mountPath, {
        dbDirty,
        dirtyPaths,
        onProgress
      });
    } else if (onProgress) {
      await onProgress({ percent: 70, label: 'Closing USB vault' });
    }
    if (session.db) {
      session.db.close();
    }
    if (onProgress && normalizedType !== 'onedrive') {
      await onProgress({ percent: 90, label: 'Finishing logoff' });
    }
    if (onProgress) await onProgress({ percent: 100, label: 'Done' });
  } finally {
    session.locked = true;
    if (session.key) session.key.fill(0);
    sessionsByKey.delete(vaultSessionKey(id, normalizedType));
    await clearVaultClusterUnlock(id, normalizedType);
    await flushVaultTransferBytes(id);
    // Freeze totals for login-gate display (survives unlock reset / rehydrate).
    await snapshotVaultSessionFileCountsToLast(id);
  }
  return { success: true };
}

/**
 * Persist dirty vault DB to staging and await OneDrive upload — same sync half as logoff,
 * without closing the session / wiping staging / clearing cache icon.
 * Use after PIN encrypt so re-open (which re-downloads vault.db) keeps the ciphertext.
 */
export async function flushAndAwaitCloudSync(singlesId, storageType = 'onedrive', { onProgress } = {}) {
  if (!isVaultCloudSyncEnabled()) {
    const local = getVaultSession(singlesId, normalizeVaultStorageType(storageType));
    if (local?.dirty) forcePersistVaultDb(local);
    return { success: true, synced: false };
  }
  const normalizedType = normalizeVaultStorageType(storageType);
  let session = getVaultSession(singlesId, normalizedType);
  if (!session) {
    session = await tryRehydrateVaultSession(singlesId, normalizedType);
  }
  if (!session) {
    return { success: true, synced: false };
  }

  const wasDirty = Boolean(session.dirty);
  if (wasDirty) {
    forcePersistVaultDb(session);
  }

  if (session.storageType !== 'onedrive' || !session.driveSinglesId) {
    return { success: true, synced: false };
  }

  const dbFileName = getVaultDbFileName(session.meta);
  // Encrypt path already flushed DB to disk + queued async upload; await it (and force db
  // upload) so a later Open Cloud re-download cannot wipe the PIN ciphertext.
  await markOneDrivePathDirty(session.driveSinglesId, dbFileName);
  const dirtyPaths = await takeOneDriveDirtyPaths(session.driveSinglesId);
  await uploadOneDriveVaultOnLogoff(session.driveSinglesId, session.mountPath, {
    dbDirty: true,
    dirtyPaths,
    onProgress
  });
  return { success: true, synced: true };
}

/** Drop in-memory vault without uploading local changes (e.g. after OneDrive restore from zip). */
export async function discardVaultSessionWithoutCloudSync(singlesId, storageType = 'onedrive') {
  const normalizedType = normalizeVaultStorageType(storageType);
  let session = getVaultSession(singlesId, normalizedType);
  if (!session) {
    session = await tryRehydrateVaultSession(singlesId, normalizedType);
  }
  if (!session) {
    const id = Number(singlesId);
    await clearVaultClusterUnlock(id, normalizedType);
    await flushVaultTransferBytes(id);
    return { success: true };
  }
  const id = Number(singlesId);
  if (session.storageType === 'onedrive' && session.driveSinglesId) {
    await clearAllOneDriveDirty(Number(session.driveSinglesId));
  }
  session.dirty = false;
  try {
    if (session.db) {
      session.db.close();
    }
  } finally {
    session.locked = true;
    if (session.key) session.key.fill(0);
    sessionsByKey.delete(vaultSessionKey(id, normalizedType));
    await clearVaultClusterUnlock(id, normalizedType);
    await flushVaultTransferBytes(id);
  }
  return { success: true };
}

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
function nextAlbumPhotoSeqForNote(session, noteId) {
  ensureAttachmentAlbumSeqColumns(session.db);
  const row = queryOne(
    session.db,
    `SELECT COALESCE(MAX(album_photo_seq), 0) + 1 AS next_seq
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
  const n = Number(row?.next_seq);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function loadAttachmentsForNote(session, noteId) {
  return queryAll(
    session.db,
    `SELECT attachment_id, note_id, file_name, file_extension, file_size_bytes, checksum, mime_type, display_order, album_photo_seq, source_taken_at_ms, created_at
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY display_order ASC, attachment_id ASC`,
    [noteId]
  ).map(mapAttachmentRow);
}

/**
 * Soft-delete note attachment rows that share byte size + SHA-256 checksum.
 * Keeps the lowest attachment_id; deletes hard files for the rest.
 * Also purges orphan byte-identical files under ENV staging / PHOTOALBUMS_FOLDER.
 * @returns {{ removedAttachmentIds: number[], kept: number }}
 */
export function vaultDedupeNoteAttachments(session, noteId) {
  const id = Number(noteId);
  if (!Number.isFinite(id) || id < 1) return { removedAttachmentIds: [], kept: 0 };

  const rows = queryAll(
    session.db,
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type, display_order, album_photo_seq, source_taken_at_ms, created_at
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY attachment_id ASC`,
    [id]
  );
  if (rows.length < 2) {
    try {
      removeDuplicateFilesInPhotoAlbumsEnvFolders({ session });
    } catch (err) {
      console.error('[vaultDedupeNoteAttachments] folder dedupe', err?.message || err);
    }
    return { removedAttachmentIds: [], kept: rows.length };
  }

  const resolved = [];
  for (const row of rows) {
    let checksum = row.checksum ? String(row.checksum).toLowerCase() : '';
    let sizeBytes = row.file_size_bytes != null ? Number(row.file_size_bytes) : 0;
    if (!checksum || !Number.isFinite(sizeBytes) || sizeBytes < 1) {
      try {
        const buffer = row.relative_path ? readEncryptedVaultFile(session, row.relative_path) : null;
        if (buffer?.length) {
          sizeBytes = buffer.length;
          checksum = crypto.createHash('sha256').update(buffer).digest('hex');
          session.db.run(
            `UPDATE note_attachments SET file_size_bytes = ?, checksum = ? WHERE attachment_id = ?`,
            [sizeBytes, checksum, row.attachment_id]
          );
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

  const removedAttachmentIds = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const [, ...dupes] = group;
    for (const dupe of dupes) {
      try {
        if (dupe.relative_path) {
          deleteEncryptedVaultFile(session, dupe.relative_path);
          deleteAttachmentVariants(session, dupe.relative_path);
        }
      } catch {
        // ignore missing file
      }
      session.db.run(`UPDATE note_attachments SET deleted_at = datetime('now') WHERE attachment_id = ?`, [
        dupe.attachment_id
      ]);
      removedAttachmentIds.push(dupe.attachment_id);
    }
  }

  if (removedAttachmentIds.length) {
    refreshNoteSearchText(session.db, id);
    markDirty(session);
    flushDbToUsb(session);
  }

  try {
    removeDuplicateFilesInPhotoAlbumsEnvFolders({ session });
  } catch (err) {
    console.error('[vaultDedupeNoteAttachments] folder dedupe', err?.message || err);
  }

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

function loadExtraImagesForNote(session, noteId) {
  if (!vaultTableExists(session.db, 'note_extra_images')) return [];
  return queryAll(
    session.db,
    `SELECT image_id, note_id, file_name, file_extension, file_size_bytes, display_order, created_at
     FROM note_extra_images
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY display_order ASC, image_id ASC`,
    [noteId]
  ).map(mapExtraImageRow);
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

function loadNote(session, noteId) {
  ensureNoteInnerEncryptColumns(session.db);
  ensureAttachmentAlbumSeqColumns(session.db);
  return queryOne(
    session.db,
    `SELECT note_id, notebook_id, note_name, body_text, display_order, created_at, updated_at,
            inner_encrypt_enabled, inner_pin_salt, inner_unlock_locked_until,
            image_file_name, image_file_extension, image_relative_path, image_checksum, image_file_size_bytes,
            image_top_file_name, image_top_file_extension, image_top_relative_path, image_top_checksum, image_top_file_size_bytes,
            image_bottom_file_name, image_bottom_file_extension, image_bottom_relative_path, image_bottom_checksum, image_bottom_file_size_bytes
     FROM notes WHERE note_id = ? AND deleted_at IS NULL`,
    [noteId]
  );
}

function loadKeywords(session, noteId) {
  return queryAll(
    session.db,
    `SELECT keyword FROM note_keywords WHERE note_id = ? ORDER BY keyword_normalized ASC`,
    [noteId]
  ).map((r) => r.keyword);
}

function mapNote(session, noteId) {
  const row = loadNote(session, noteId);
  if (!row) return null;
  return mapNoteRow(row, loadKeywords(session, noteId), loadAttachmentsForNote(session, noteId), loadExtraImagesForNote(session, noteId));
}

export function vaultGetNote(session, noteId) {
  // Display path: purge size+checksum duplicate attachments + ENV folder hard dupes.
  try {
    vaultDedupeNoteAttachments(session, noteId);
  } catch (err) {
    console.error('[vaultGetNote] attachment dedupe', err?.message || err);
  }
  return mapNote(session, noteId);
}

/** Notebook/note sidebar tree — metadata only; no body_text, keywords, attachments, or extra_images. */
export function vaultGetTree(session) {
  ensureNoteInnerEncryptColumns(session.db);
  ensureAttachmentAlbumSeqColumns(session.db);
  const notebooks = queryAll(
    session.db,
    `SELECT notebook_id, notebook_name, display_order, created_at, updated_at
     FROM notebooks WHERE deleted_at IS NULL
     ORDER BY display_order ASC, notebook_id ASC`
  );
  const notes = queryAll(
    session.db,
    `SELECT note_id, notebook_id, note_name, display_order, created_at, updated_at,
            inner_encrypt_enabled, inner_unlock_locked_until,
            image_file_name, image_file_extension, image_relative_path, image_file_size_bytes,
            image_top_file_name, image_top_file_extension, image_top_relative_path, image_top_file_size_bytes,
            image_bottom_file_name, image_bottom_file_extension, image_bottom_relative_path, image_bottom_file_size_bytes
     FROM notes WHERE deleted_at IS NULL
     ORDER BY display_order ASC, note_id ASC`
  );
  const notesByNotebook = new Map();
  const albumMediaCountByNoteId = loadPhotoAlbumsAlbumMediaCountByNoteId(session.db, queryAll);
  for (const row of notes) {
    const notebookId = Number(row.notebook_id);
    if (!notesByNotebook.has(notebookId)) notesByNotebook.set(notebookId, []);
    notesByNotebook
      .get(notebookId)
      .push(mapNoteRowMetadata(row, albumMediaCountByNoteId.get(Number(row.note_id)) || 0));
  }
  const shortcutRows = queryAll(
    session.db,
    `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
            nb.notebook_name, n.note_name
     FROM shortcuts s
     JOIN notebooks nb ON nb.notebook_id = s.notebook_id AND nb.deleted_at IS NULL
     LEFT JOIN notes n ON n.note_id = s.note_id AND n.deleted_at IS NULL
     WHERE s.target_type = 'notebook' OR n.note_id IS NOT NULL
     ORDER BY s.display_order ASC, s.shortcut_id ASC`
  );
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

const INNER_ENCRYPT_BODY_PREFIX = '\u2063RVI';

function noteHasInnerPinEncryption(row) {
  if (Number(row?.inner_encrypt_enabled) === 1) return true;
  return String(row?.body_text || '').startsWith(INNER_ENCRYPT_BODY_PREFIX);
}

export function vaultSearch(session, chain, evaluateChain) {
  const rows = queryAll(
    session.db,
    `SELECT n.note_id, n.notebook_id, n.note_name, n.body_text, n.display_order, n.inner_encrypt_enabled,
            nb.notebook_name
     FROM notes n
     INNER JOIN notebooks nb ON nb.notebook_id = n.notebook_id AND nb.deleted_at IS NULL
     WHERE n.deleted_at IS NULL
     ORDER BY n.notebook_id ASC, n.display_order ASC, n.note_id ASC`
  );
  const results = [];
  for (const row of rows) {
    // PIN-locked notes must not appear in search (name/body leak).
    if (noteHasInnerPinEncryption(row)) continue;
    const keywords = loadKeywords(session, row.note_id);
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

export function vaultCreateNotebook(session, notebookName) {
  const orderRow = queryOne(
    session.db,
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM notebooks WHERE deleted_at IS NULL`
  );
  const displayOrder = Number(orderRow?.next_order ?? 0);
  session.db.run(`INSERT INTO notebooks (notebook_name, display_order) VALUES (?, ?)`, [
    notebookName,
    displayOrder
  ]);
  const row = queryOne(session.db, `SELECT last_insert_rowid() AS notebook_id`);
  markDirty(session);
  flushDbToUsb(session);
  return queryOne(
    session.db,
    `SELECT notebook_id, notebook_name, display_order, created_at, updated_at FROM notebooks WHERE notebook_id = ?`,
    [row.notebook_id]
  );
}

export function vaultUpdateNotebook(session, notebookId, notebookName) {
  session.db.run(
    `UPDATE notebooks SET notebook_name = ?, updated_at = datetime('now') WHERE notebook_id = ? AND deleted_at IS NULL`,
    [notebookName, notebookId]
  );
  markDirty(session);
  flushDbToUsb(session);
  return queryOne(
    session.db,
    `SELECT notebook_id, notebook_name, display_order, created_at, updated_at FROM notebooks WHERE notebook_id = ?`,
    [notebookId]
  );
}

export function vaultDeleteNotebook(session, notebookId) {
  const noteRows = queryAll(
    session.db,
    `SELECT note_id FROM notes WHERE notebook_id = ? AND deleted_at IS NULL`,
    [notebookId]
  );
  for (const note of noteRows) {
    try {
      vaultDeleteNote(session, Number(note.note_id), { skipFlush: true });
    } catch (err) {
      console.error('[vaultDeleteNotebook] note cleanup', note?.note_id, err?.message || err);
    }
  }
  // Wipe leftover files/{notebookId}/ and photos/{notebookId}/ (orphans + empty dirs).
  removeNotebookMediaDirs(session, notebookId);
  session.db.run(`UPDATE notebooks SET deleted_at = datetime('now') WHERE notebook_id = ?`, [notebookId]);
  session.db.run(
    `UPDATE notes SET deleted_at = datetime('now') WHERE notebook_id = ? AND deleted_at IS NULL`,
    [notebookId]
  );
  session.db.run(`DELETE FROM shortcuts WHERE notebook_id = ?`, [notebookId]);
  markDirty(session);
  flushDbToUsb(session);
}

export function vaultReorderNotebooks(session, notebookIds) {
  notebookIds.forEach((id, i) => {
    session.db.run(
      `UPDATE notebooks SET display_order = ?, updated_at = datetime('now') WHERE notebook_id = ? AND deleted_at IS NULL`,
      [i, id]
    );
  });
  markDirty(session);
  flushDbToUsb(session);
}

async function nextNoteDisplayOrder(session, notebookId) {
  const row = queryOne(
    session.db,
    `SELECT COALESCE(MIN(display_order), 0) - 1 AS next_order FROM notes WHERE notebook_id = ? AND deleted_at IS NULL`,
    [notebookId]
  );
  return Number(row?.next_order ?? -1);
}

export async function vaultCreateNote(
  session,
  notebookId,
  { noteName, bodyText, keywords, imageBuffer, imageExt, innerEncryptEnabled, innerPinSalt }
) {
  const nb = queryOne(
    session.db,
    `SELECT notebook_id FROM notebooks WHERE deleted_at IS NULL AND notebook_id = ?`,
    [notebookId]
  );
  if (!nb) throw new Error('Notebook not found');

  const displayOrder = await nextNoteDisplayOrder(session, notebookId);
  const name = noteName || 'New Note';
  const body = bodyText ?? DEFAULT_BODY_TEXT;
  const innerEnabled = innerEncryptEnabled ? 1 : 0;
  const innerSalt = innerPinSalt ? String(innerPinSalt).trim().slice(0, 512) : null;
  session.db.run(
    `INSERT INTO notes (notebook_id, note_name, body_text, display_order, inner_encrypt_enabled, inner_pin_salt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [notebookId, name, body, displayOrder, innerEnabled, innerSalt]
  );
  const noteId = queryOne(session.db, `SELECT last_insert_rowid() AS note_id`).note_id;
  refreshNoteSearchText(session.db, noteId);

  if (imageBuffer?.length) {
    const ext = imageExt || 'jpg';
    const relativePath = photoRelativePath(notebookId, noteId, 'center', ext);
    writeEncryptedPhoto(session, relativePath, imageBuffer);
    const checksum = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    session.db.run(
      `UPDATE notes SET image_relative_path = ?, image_file_extension = ?, image_file_size_bytes = ?,
              image_checksum = ?, image_file_name = ?, updated_at = datetime('now')
       WHERE note_id = ?`,
      [relativePath, ext, imageBuffer.length, checksum, `note_${noteId}`, noteId]
    );
  }

  if (keywords) {
    vaultReplaceKeywords(session, noteId, keywords);
  } else {
    refreshNoteSearchText(session.db, noteId);
  }

  markDirty(session);
  flushDbToUsb(session);
  return mapNote(session, noteId);
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

export function vaultUpdateNote(session, noteId, patch) {
  const row = loadNote(session, noteId);
  if (!row) throw new Error('Note not found');

  if (patch.notebook_id != null && Number(patch.notebook_id) !== Number(row.notebook_id)) {
    const targetNb = Number(patch.notebook_id);
    const nb = queryOne(
      session.db,
      `SELECT notebook_id FROM notebooks WHERE notebook_id = ? AND deleted_at IS NULL`,
      [targetNb]
    );
    if (!nb) throw new Error('Target notebook not found');
    session.db.run(`UPDATE notes SET notebook_id = ?, updated_at = datetime('now') WHERE note_id = ?`, [
      targetNb,
      noteId
    ]);
  }

  if (patch.note_name != null) {
    session.db.run(`UPDATE notes SET note_name = ?, updated_at = datetime('now') WHERE note_id = ?`, [
      patch.note_name,
      noteId
    ]);
  }
  if (patch.body_text != null) {
    session.db.run(`UPDATE notes SET body_text = ?, updated_at = datetime('now') WHERE note_id = ?`, [
      patch.body_text,
      noteId
    ]);
  }
  if (patch.inner_encrypt_enabled != null) {
    const enabled = patch.inner_encrypt_enabled ? 1 : 0;
    session.db.run(`UPDATE notes SET inner_encrypt_enabled = ?, updated_at = datetime('now') WHERE note_id = ?`, [
      enabled,
      noteId
    ]);
  }
  if (patch.inner_pin_salt !== undefined) {
    const salt = patch.inner_pin_salt == null ? null : String(patch.inner_pin_salt);
    session.db.run(`UPDATE notes SET inner_pin_salt = ?, updated_at = datetime('now') WHERE note_id = ?`, [
      salt,
      noteId
    ]);
  }
  if (patch.inner_unlock_locked_until !== undefined) {
    const until =
      patch.inner_unlock_locked_until == null || patch.inner_unlock_locked_until === ''
        ? null
        : String(patch.inner_unlock_locked_until).trim().slice(0, 64);
    session.db.run(
      `UPDATE notes SET inner_unlock_locked_until = ?, updated_at = datetime('now') WHERE note_id = ?`,
      [until, noteId]
    );
  }

  for (const slot of ['center', 'top', 'bottom']) {
    const clearKey =
      slot === 'top' ? 'clear_image_top' : slot === 'bottom' ? 'clear_image_bottom' : 'clear_image';
    const imageKey = slot === 'top' ? 'image_top' : slot === 'bottom' ? 'image_bottom' : 'image';
    if (patch[clearKey]) {
      const fields = slotFields(slot);
      const rel = row[fields.relative];
      deleteEncryptedPhoto(session, rel);
      session.db.run(
        `UPDATE notes SET ${fields.relative} = NULL, ${fields.ext} = NULL, ${fields.size} = NULL,
                ${fields.checksum} = NULL, ${fields.name} = NULL, updated_at = datetime('now')
         WHERE note_id = ?`,
        [noteId]
      );
    } else if (patch[`${imageKey}Parsed`]?.buffer?.length) {
      const parsed = patch[`${imageKey}Parsed`];
      const current = loadNote(session, noteId);
      const fields = slotFields(slot);
      const ext = parsed.ext || 'jpg';
      const relativePath = photoRelativePath(current.notebook_id, noteId, slot, ext);
      deleteEncryptedPhoto(session, current[fields.relative]);
      writeEncryptedPhoto(session, relativePath, parsed.buffer);
      const checksum = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
      session.db.run(
        `UPDATE notes SET ${fields.relative} = ?, ${fields.ext} = ?, ${fields.size} = ?,
                ${fields.checksum} = ?, ${fields.name} = ?, updated_at = datetime('now')
         WHERE note_id = ?`,
        [
          relativePath,
          ext,
          parsed.buffer.length,
          checksum,
          slot === 'center' ? `note_${noteId}` : `note_${noteId}_${slot}`,
          noteId
        ]
      );
    }
  }

  if (patch.keywords != null) {
    vaultReplaceKeywords(session, noteId, patch.keywords);
  } else {
    refreshNoteSearchText(session.db, noteId);
  }

  markDirty(session);
  flushDbToUsb(session);
  return mapNote(session, noteId);
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

function writeSlotPlainImage(session, noteId, notebookId, slot, plainBuffer, meta = {}) {
  const fields = slotFields(slot);
  if (!plainBuffer?.length) {
    session.db.run(
      `UPDATE notes SET ${fields.relative} = NULL, ${fields.ext} = NULL, ${fields.size} = NULL,
              ${fields.checksum} = NULL, ${fields.name} = NULL, updated_at = datetime('now')
       WHERE note_id = ?`,
      [noteId]
    );
    return;
  }

  const ext = String(meta.ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const relativePath = photoRelativePath(notebookId, noteId, slot, ext);
  writeEncryptedPhoto(session, relativePath, plainBuffer);
  const checksum = meta.checksum || crypto.createHash('sha256').update(plainBuffer).digest('hex');
  const name = slot === 'center' ? `note_${noteId}` : `note_${noteId}_${slot}`;
  session.db.run(
    `UPDATE notes SET ${fields.relative} = ?, ${fields.ext} = ?, ${fields.size} = ?,
            ${fields.checksum} = ?, ${fields.name} = ?, updated_at = datetime('now')
     WHERE note_id = ?`,
    [relativePath, ext, plainBuffer.length, checksum, name, noteId]
  );
}

export function vaultMoveNoteImage(session, fromNoteId, fromSlot, toNoteId, toSlot) {
  const sourceSlot = normalizeVaultImageSlot(fromSlot);
  const targetSlot = normalizeVaultImageSlot(toSlot);
  const fromId = Number(fromNoteId);
  const toId = Number(toNoteId);
  if (!Number.isFinite(fromId) || fromId < 1 || !Number.isFinite(toId) || toId < 1) {
    throw new Error('Invalid note id');
  }
  if (fromId === toId && sourceSlot === targetSlot) {
    const note = mapNote(session, fromId);
    return { fromNote: note, toNote: note };
  }

  const fromRow = loadNote(session, fromId);
  const toRow = loadNote(session, toId);
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

  writeSlotPlainImage(session, toId, toRow.notebook_id, targetSlot, plainFrom, fromMeta);

  if (plainTo?.length) {
    writeSlotPlainImage(session, fromId, fromRow.notebook_id, sourceSlot, plainTo, toMeta);
  } else {
    session.db.run(
      `UPDATE notes SET ${fromFields.relative} = NULL, ${fromFields.ext} = NULL, ${fromFields.size} = NULL,
              ${fromFields.checksum} = NULL, ${fromFields.name} = NULL, updated_at = datetime('now')
       WHERE note_id = ?`,
      [fromId]
    );
  }

  refreshNoteSearchText(session.db, fromId);
  if (toId !== fromId) refreshNoteSearchText(session.db, toId);
  markDirty(session);
  flushDbToUsb(session);
  return { fromNote: mapNote(session, fromId), toNote: mapNote(session, toId) };
}

function vaultReplaceKeywords(session, noteId, keywords) {
  session.db.run(`DELETE FROM note_keywords WHERE note_id = ?`, [noteId]);
  const list = Array.isArray(keywords) ? keywords : [];
  const seen = new Set();
  for (const raw of list) {
    const keyword = String(raw ?? '').trim().slice(0, 80);
    const normalized = normalizePhotoAlbumsKeyword(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    session.db.run(
      `INSERT INTO note_keywords (note_id, keyword, keyword_normalized) VALUES (?, ?, ?)`,
      [noteId, keyword, normalized]
    );
  }
  refreshNoteSearchText(session.db, noteId);
}

/**
 * Remove on-disk media for one album (note): files/{notebookId}/{noteId}/ (all att_* +
 * _1000px / _thumbnail siblings) and any known photos/ slots. Works under
 * LARGE_CHEAP_STORAGE_FOLDER (TutaDrive), USB, and OneDrive staging mirrors.
 */
function removeNoteMediaDirs(session, notebookId, noteId) {
  const nb = String(notebookId);
  const nid = String(noteId);
  writeToMirrorPaths(session, (mountPath) => {
    removeDirRecursive(path.join(vaultFilesRoot(mountPath), nb, nid));
  });
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(session, `${VAULT_FILES_DIR}/${nb}/${nid}`);
  }
}

function removeNotebookMediaDirs(session, notebookId) {
  const nb = String(notebookId);
  writeToMirrorPaths(session, (mountPath) => {
    removeDirRecursive(path.join(vaultFilesRoot(mountPath), nb));
    removeDirRecursive(path.join(vaultPhotosRoot(mountPath), nb));
  });
  if (session.storageType === 'onedrive') {
    scheduleCloudRelativeSync(session, `${VAULT_FILES_DIR}/${nb}`);
    scheduleCloudRelativeSync(session, `${VAULT_PHOTOS_DIR}/${nb}`);
  }
}

export function vaultDeleteNote(session, noteId, { skipFlush = false } = {}) {
  const row = loadNote(session, noteId);
  if (!row) throw new Error('Note not found');
  for (const rel of [row.image_relative_path, row.image_top_relative_path, row.image_bottom_relative_path]) {
    deleteEncryptedPhoto(session, rel);
  }
  if (vaultTableExists(session.db, 'note_extra_images')) {
    const extraImageRows = queryAll(
      session.db,
      `SELECT relative_path FROM note_extra_images WHERE note_id = ? AND deleted_at IS NULL`,
      [noteId]
    );
    for (const img of extraImageRows) {
      deleteEncryptedPhoto(session, img.relative_path);
    }
    session.db.run(`UPDATE note_extra_images SET deleted_at = datetime('now') WHERE note_id = ? AND deleted_at IS NULL`, [
      noteId
    ]);
  }
  // Include already soft-deleted rows so orphaned disk files are still removed.
  const attachmentRows = queryAll(
    session.db,
    `SELECT relative_path FROM note_attachments WHERE note_id = ?`,
    [noteId]
  );
  for (const att of attachmentRows) {
    if (!att.relative_path) continue;
    deleteEncryptedVaultFile(session, att.relative_path);
    deleteAttachmentVariants(session, att.relative_path);
  }
  // Nuclear: remove entire album folder (catches any leftover variants / orphans).
  removeNoteMediaDirs(session, row.notebook_id, noteId);
  session.db.run(`UPDATE note_attachments SET deleted_at = datetime('now') WHERE note_id = ? AND deleted_at IS NULL`, [
    noteId
  ]);
  session.db.run(`UPDATE notes SET deleted_at = datetime('now') WHERE note_id = ?`, [noteId]);
  session.db.run(`DELETE FROM shortcuts WHERE note_id = ?`, [noteId]);
  markDirty(session);
  if (!skipFlush) flushDbToUsb(session);
}

export function vaultReorderNotes(session, notebookId, noteIds) {
  noteIds.forEach((id, i) => {
    session.db.run(
      `UPDATE notes SET display_order = ?, updated_at = datetime('now')
       WHERE note_id = ? AND notebook_id = ? AND deleted_at IS NULL`,
      [i, id, notebookId]
    );
  });
  markDirty(session);
  flushDbToUsb(session);
}

export function vaultGetNoteImage(session, noteId, slot = 'center') {
  const row = loadNote(session, noteId);
  if (!row) return null;
  const fields = slotFields(slot);
  const relative = row[fields.relative];
  if (!relative) return null;
  const buffer = readEncryptedPhoto(session, relative);
  if (!buffer) return null;
  const ext = String(row[fields.ext] || 'jpg').toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { buffer, contentType };
}

export async function vaultEnsureNotePhotoOnDisk(session, noteId, slot = 'center') {
  if (!isVaultCloudSyncEnabled()) return;
  if (session.storageType !== 'onedrive') return;
  const row = loadNote(session, noteId);
  if (!row) return;
  const fields = slotFields(slot);
  const relative = row[fields.relative];
  if (!relative) return;
  await ensureOneDriveVaultPhotoOnDisk(session.driveSinglesId, session.mountPath, relative, session.meta);
}

export async function vaultEnsureNoteExtraImageOnDisk(session, noteId, imageId) {
  if (!isVaultCloudSyncEnabled()) return;
  if (session.storageType !== 'onedrive') return;
  const row = queryOne(
    session.db,
    `SELECT relative_path FROM note_extra_images
     WHERE image_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [imageId, noteId]
  );
  if (!row?.relative_path) return;
  await ensureOneDriveVaultPhotoOnDisk(session.driveSinglesId, session.mountPath, row.relative_path, session.meta);
}

export async function vaultEnsureNoteAttachmentOnDisk(session, noteId, attachmentId, { variant: variantRaw } = {}) {
  if (!isVaultCloudSyncEnabled()) return;
  if (session.storageType !== 'onedrive') return;
  const row = queryOne(
    session.db,
    `SELECT relative_path FROM note_attachments
     WHERE attachment_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [attachmentId, noteId]
  );
  if (!row?.relative_path) return;
  await ensureOneDriveVaultFileOnDisk(session.driveSinglesId, session.mountPath, row.relative_path, session.meta);
  const variant = normalizeAttachmentVariant(variantRaw);
  if (variant === 'display' || variant === 'thumb') {
    const sibling = fileRelativePathForVariant(row.relative_path, variant);
    if (sibling && sibling !== row.relative_path) {
      try {
        await ensureOneDriveVaultFileOnDisk(session.driveSinglesId, session.mountPath, sibling, session.meta);
      } catch {
        // Missing sibling → vaultGetNoteAttachment falls back to full.
      }
    }
  }
}

export function vaultAddNoteExtraImage(session, noteId, { buffer, ext }) {
  ensureNoteExtraImagesTable(session.db);
  const row = loadNote(session, noteId);
  if (!row) throw new Error('Note not found');
  if (!buffer?.length) throw new Error('Image is empty');

  const cleanExt = String(ext || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const orderRow = queryOne(
    session.db,
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM note_extra_images WHERE note_id = ?`,
    [noteId]
  );
  const displayOrder = Number(orderRow?.next_order ?? 0);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  session.db.run(
    `INSERT INTO note_extra_images (note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, display_order)
     VALUES (?, ?, ?, '', ?, ?, ?)`,
    [noteId, `note_${noteId}_extra`, cleanExt, buffer.length, checksum, displayOrder]
  );
  const imageId = Number(queryOne(session.db, `SELECT last_insert_rowid() AS image_id`).image_id);
  const relativePath = extraPhotoRelativePath(row.notebook_id, noteId, imageId, cleanExt);
  session.db.run(`UPDATE note_extra_images SET relative_path = ? WHERE image_id = ?`, [relativePath, imageId]);
  writeEncryptedPhoto(session, relativePath, buffer);
  scheduleFlushDbToUsb(session);
  return mapNote(session, noteId);
}

export function vaultDeleteNoteExtraImage(session, noteId, imageId) {
  const row = queryOne(
    session.db,
    `SELECT image_id, relative_path FROM note_extra_images
     WHERE image_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [imageId, noteId]
  );
  if (!row) throw new Error('Image not found');
  deleteEncryptedPhoto(session, row.relative_path);
  session.db.run(`UPDATE note_extra_images SET deleted_at = datetime('now') WHERE image_id = ?`, [imageId]);
  markDirty(session);
  flushDbToUsb(session);
  return mapNote(session, noteId);
}

export function vaultGetNoteExtraImage(session, noteId, imageId) {
  const row = queryOne(
    session.db,
    `SELECT file_extension, relative_path FROM note_extra_images
     WHERE image_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [imageId, noteId]
  );
  if (!row?.relative_path) return null;
  const buffer = readEncryptedPhoto(session, row.relative_path);
  if (!buffer) return null;
  const ext = String(row.file_extension || 'jpg').toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { buffer, contentType };
}

/**
 * Backfill album_photo_seq for rows that lack it (does not rename on-disk files).
 * Upload assigns seq + att_{id}_{seq}.* at insert time.
 */
export function vaultReconcileAlbumPhotoSeq(session, noteId) {
  const id = Number(noteId);
  if (!session?.db || !Number.isFinite(id) || id < 1) return [];
  ensureAttachmentAlbumSeqColumns(session.db);
  const rows = queryAll(
    session.db,
    `SELECT attachment_id, source_taken_at_ms, file_name, relative_path, album_photo_seq
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL
     ORDER BY COALESCE(source_taken_at_ms, 0) ASC, file_name COLLATE NOCASE ASC, attachment_id ASC`,
    [id]
  );
  let maxSeq = rows.reduce((m, row) => {
    const fromDb = Number(row.album_photo_seq);
    const fromPath = parseAlbumPhotoSeqFromAttRelativePath(row.relative_path);
    const seq =
      Number.isFinite(fromDb) && fromDb >= 1
        ? fromDb
        : Number.isFinite(fromPath) && fromPath >= 1
          ? fromPath
          : 0;
    return Math.max(m, seq);
  }, 0);
  for (const row of rows) {
    const fromDb = Number(row.album_photo_seq);
    const fromPath = parseAlbumPhotoSeqFromAttRelativePath(row.relative_path);
    if ((Number.isFinite(fromDb) && fromDb >= 1) || (Number.isFinite(fromPath) && fromPath >= 1)) {
      const seq = Number.isFinite(fromDb) && fromDb >= 1 ? fromDb : fromPath;
      if (!Number.isFinite(fromDb) || fromDb !== seq) {
        session.db.run(`UPDATE note_attachments SET album_photo_seq = ? WHERE attachment_id = ?`, [
          seq,
          row.attachment_id
        ]);
      }
      continue;
    }
    maxSeq += 1;
    session.db.run(`UPDATE note_attachments SET album_photo_seq = ? WHERE attachment_id = ?`, [
      maxSeq,
      row.attachment_id
    ]);
  }
  markDirty(session);
  return loadAttachmentsForNote(session, id);
}

/**
 * Repair attachments stored before their format could be decoded (HEIC/HEIF/BMP):
 * rebuild missing _1000px/_thumbnail siblings and re-encode full files that no
 * browser can render. Safe to re-run; already-complete attachments are skipped.
 */
export async function vaultRepairMissingAttachmentVariants(session, noteId) {
  const id = Number(noteId);
  if (!session?.db || !Number.isFinite(id) || id < 1) return { repaired: 0, failed: 0 };
  const note = loadNote(session, id);
  if (!note) throw new Error('Note not found');

  const rows = queryAll(
    session.db,
    `SELECT attachment_id, file_name, file_extension, relative_path, album_photo_seq
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL`,
    [id]
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
        session.db.run(
          `UPDATE note_attachments
           SET relative_path = ?, file_extension = 'jpg', mime_type = 'image/jpeg', file_name = ?,
               file_size_bytes = ?, checksum = ?
           WHERE attachment_id = ?`,
          [
            relativePath,
            safeName,
            workingBuffer.length,
            crypto.createHash('sha256').update(workingBuffer).digest('hex'),
            row.attachment_id
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

  if (repaired) {
    markDirty(session);
    scheduleFlushDbToUsb(session);
  }
  return { repaired, failed };
}

/**
 * Free-tier quota counters: how many image / video attachments this account
 * currently keeps across every album. Counts live attachments only, so deleting
 * media frees quota back up.
 *
 * @returns {{ imageCount: number, videoCount: number }}
 */
export function vaultCountAccountMedia(session) {
  const rows = queryAll(
    session.db,
    `SELECT file_extension, COUNT(*) AS n
       FROM note_attachments
      WHERE deleted_at IS NULL
      GROUP BY file_extension`
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
  const row = loadNote(session, noteId);
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
  const sameSizeRows = queryAll(
    session.db,
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type, display_order, album_photo_seq, source_taken_at_ms, created_at
     FROM note_attachments
     WHERE note_id = ? AND deleted_at IS NULL AND file_size_bytes = ?`,
    [noteId, sizeBytes]
  );
  for (const candidate of sameSizeRows) {
    let candidateChecksum = candidate.checksum ? String(candidate.checksum) : '';
    if (!candidateChecksum && candidate.relative_path) {
      try {
        const existingBuf = readEncryptedVaultFile(session, candidate.relative_path);
        if (existingBuf?.length === sizeBytes) {
          candidateChecksum = crypto.createHash('sha256').update(existingBuf).digest('hex');
          session.db.run(`UPDATE note_attachments SET checksum = ? WHERE attachment_id = ?`, [
            candidateChecksum,
            candidate.attachment_id
          ]);
        }
      } catch {
        // ignore
      }
    }
    if (candidateChecksum && candidateChecksum === checksum) {
      try {
        vaultDedupeNoteAttachments(session, noteId);
      } catch (err) {
        console.error('[vaultAddNoteAttachment] note dedupe', err?.message || err);
      }
      return { ...mapAttachmentRow(candidate), duplicate: true };
    }
  }

  const orderRow = queryOne(
    session.db,
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM note_attachments WHERE note_id = ?`,
    [noteId]
  );
  const displayOrder = Number(orderRow?.next_order ?? 0);
  const takenMs =
    Number.isFinite(Number(sourceTakenAtMs)) && Number(sourceTakenAtMs) > 0
      ? Math.round(Number(sourceTakenAtMs))
      : Date.now();
  const albumPhotoSeq = nextAlbumPhotoSeqForNote(session, noteId);

  session.db.run(
    `INSERT INTO note_attachments (note_id, file_name, file_extension, relative_path, file_size_bytes, checksum, mime_type, display_order, source_taken_at_ms, album_photo_seq)
     VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
    [noteId, safeName, cleanExt, sizeBytes, checksum, resolvedMime, displayOrder, takenMs, albumPhotoSeq]
  );
  const attachmentId = Number(queryOne(session.db, `SELECT last_insert_rowid() AS attachment_id`).attachment_id);
  const relativePath = fileRelativePath(
    row.notebook_id,
    noteId,
    attachmentId,
    cleanExt,
    albumPhotoSeq
  );
  session.db.run(`UPDATE note_attachments SET relative_path = ? WHERE attachment_id = ?`, [
    relativePath,
    attachmentId
  ]);
  writeEncryptedVaultFile(session, relativePath, workingBuffer);

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
  }

  refreshNoteSearchText(session.db, noteId);
  scheduleFlushDbToUsb(session);
  try {
    vaultDedupeNoteAttachments(session, noteId);
  } catch (err) {
    console.error('[vaultAddNoteAttachment] note dedupe', err?.message || err);
  }
  return mapAttachmentRow(
    queryOne(
      session.db,
      `SELECT attachment_id, note_id, file_name, file_extension, file_size_bytes, checksum, mime_type, display_order, album_photo_seq, source_taken_at_ms, created_at
       FROM note_attachments WHERE attachment_id = ?`,
      [attachmentId]
    )
  );
}

function deleteAttachmentVariants(session, relativePath) {
  if (!relativePath) return;
  deleteEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'display'));
  deleteEncryptedVaultFile(session, fileRelativePathForVariant(relativePath, 'thumb'));
}

export function vaultDeleteNoteAttachment(session, noteId, attachmentId) {
  const row = queryOne(
    session.db,
    `SELECT attachment_id, relative_path FROM note_attachments
     WHERE attachment_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [attachmentId, noteId]
  );
  if (!row) throw new Error('Attachment not found');
  deleteEncryptedVaultFile(session, row.relative_path);
  deleteAttachmentVariants(session, row.relative_path);
  session.db.run(`UPDATE note_attachments SET deleted_at = datetime('now') WHERE attachment_id = ?`, [attachmentId]);
  refreshNoteSearchText(session.db, noteId);
  markDirty(session);
  flushDbToUsb(session);
  return { success: true, attachment_id: Number(attachmentId) };
}

export function vaultGetNoteAttachment(session, noteId, attachmentId, { variant: variantRaw } = {}) {
  const row = queryOne(
    session.db,
    `SELECT attachment_id, note_id, file_name, file_extension, relative_path, mime_type
     FROM note_attachments
     WHERE attachment_id = ? AND note_id = ? AND deleted_at IS NULL`,
    [attachmentId, noteId]
  );
  if (!row) return null;
  const variant = normalizeAttachmentVariant(variantRaw);
  const basePath = row.relative_path;
  let rel = basePath;
  if (variant === 'display' || variant === 'thumb') {
    const preferred = fileRelativePathForVariant(basePath, variant);
    const preferredBuf = readEncryptedVaultFile(session, preferred);
    if (preferredBuf?.length) {
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
      const thumbBuf = readEncryptedVaultFile(session, thumbPath);
      if (thumbBuf?.length) {
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

export function vaultCreateShortcut(session, { targetType, notebookId, noteId }) {
  const existing =
    targetType === 'notebook'
      ? queryOne(
          session.db,
          `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
                  nb.notebook_name AS label
           FROM shortcuts s
           JOIN notebooks nb ON nb.notebook_id = s.notebook_id
           WHERE s.target_type = 'notebook' AND s.notebook_id = ? AND nb.deleted_at IS NULL
           LIMIT 1`,
          [notebookId]
        )
      : queryOne(
          session.db,
          `SELECT s.shortcut_id, s.target_type, s.notebook_id, s.note_id, s.display_order,
                  n.note_name AS label
           FROM shortcuts s
           JOIN notes n ON n.note_id = s.note_id
           WHERE s.target_type = 'note' AND s.notebook_id = ? AND s.note_id = ? AND n.deleted_at IS NULL
           LIMIT 1`,
          [notebookId, noteId]
        );
  if (existing) {
    return {
      shortcut_id: Number(existing.shortcut_id),
      target_type: existing.target_type,
      notebook_id: Number(existing.notebook_id),
      note_id: existing.note_id != null ? Number(existing.note_id) : null,
      label: existing.label || '',
      display_order: Number(existing.display_order ?? 0)
    };
  }

  const orderRow = queryOne(session.db, `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM shortcuts`);
  const displayOrder = Number(orderRow?.next_order ?? 0);
  session.db.run(
    `INSERT INTO shortcuts (target_type, notebook_id, note_id, display_order) VALUES (?, ?, ?, ?)`,
    [targetType, notebookId, targetType === 'note' ? noteId : null, displayOrder]
  );
  const shortcutId = queryOne(session.db, `SELECT last_insert_rowid() AS shortcut_id`).shortcut_id;
  markDirty(session);
  flushDbToUsb(session);
  const labelRow =
    targetType === 'notebook'
      ? queryOne(session.db, `SELECT notebook_name AS label FROM notebooks WHERE notebook_id = ?`, [notebookId])
      : queryOne(session.db, `SELECT note_name AS label FROM notes WHERE note_id = ?`, [noteId]);
  return {
    shortcut_id: Number(shortcutId),
    target_type: targetType,
    notebook_id: Number(notebookId),
    note_id: targetType === 'note' ? Number(noteId) : null,
    label: labelRow?.label || '',
    display_order: displayOrder
  };
}

export function vaultDeleteShortcut(session, shortcutId) {
  session.db.run(`DELETE FROM shortcuts WHERE shortcut_id = ?`, [shortcutId]);
  markDirty(session);
  flushDbToUsb(session);
}

export function vaultReorderShortcuts(session, shortcutIds) {
  shortcutIds.forEach((id, i) => {
    session.db.run(
      `UPDATE shortcuts SET display_order = ?, updated_at = datetime('now') WHERE shortcut_id = ?`,
      [i, id]
    );
  });
  markDirty(session);
  flushDbToUsb(session);
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
        ? 'OneDrive'
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
