import fs from 'fs';
import path from 'path';
import os from 'os';
import initSqlJs from 'sql.js';
import { trackVaultTransferBytes, isVaultTransferQuotaExhausted, getVaultTransferThrottleRefillLabel } from '../photoAlbumsTransferTracking.js';
import {
  VAULT_FILES_DIR,
  VAULT_META_FILE,
  VAULT_PHOTOS_DIR,
  getVaultDbFileName,
  listVaultDbFileNames,
  listVaultDbFileNamesForRead,
  isSqliteVaultDbBuffer,
  isSqliteVaultDbFile,
  isVaultDbRelativePath,
  atomicWriteFileSync,
  useEncryptedVaultFilenames,
  vaultPhotoStorageRelativePath,
  vaultFileStorageRelativePath,
  vaultPhotosRoot,
  vaultFilesRoot,
  vaultMetaPath,
  vaultRootOnMount,
  ensureVaultLayoutDirs,
  normalizeVaultStagingFilenames,
  VAULT_DB_FILE_ENCRYPTED
} from '../photoAlbumsUsb/vaultPaths.js';
import {
  createOneDriveFolder,
  deleteOneDriveItem,
  deleteOneDriveItemAtPath,
  downloadOneDriveFile,
  downloadOneDriveFileAtPath,
  ensureVaultRootFolder,
  findOneDriveItemByName,
  getOneDriveItem,
  getOneDriveItemAtPath,
  getOneDriveVaultFolderName,
  isOneDriveVaultRootFolderName,
  listOneDriveVaultRootFolderNamesToPurge,
  listOneDriveChildren,
  refreshOneDriveAccessToken,
  upsertOneDriveFileAtPath
} from './oneDriveApi.js';
import { loadOneDriveConnection, saveOneDriveConnection } from './oneDriveTokenStore.js';
import {
  getCachedOneDriveAuth,
  invalidateCachedOneDriveAuth,
  setCachedOneDriveAuth
} from './oneDriveAuthCache.js';
import { getUnlockGuardStatusFromMeta } from '../photoAlbumsUsb/unlockGuard.js';
import { readVaultMeta, validateVaultOnMount } from '../photoAlbumsUsb/usbScan.js';
import { initializeVaultOnUsbWithKey } from '../photoAlbumsUsb/vaultSession.js';
import { isPlaintextVaultKey } from '../photoAlbumsUsb/vaultCrypto.js';
import {
  vaultMetaUsesPlaintextStorage,
  isPhotoAlbumsIconEncryptionEnabled
} from '../photoAlbumsIconEncryption.js';
import { rvCloudConnSnapshot, rvCloudDebug, rvCloudError, rvCloudLog, rvCloudWarn } from '../photoAlbumsCloudDebugLog.js';
import {
  clearAllOneDriveDirty,
  clearOneDrivePathDirty,
  normalizeOneDriveRelativePath
} from './oneDriveVaultDirty.js';
import {
  clusterRedisDel,
  clusterRedisGet,
  clusterRedisGetInt,
  clusterRedisIncrBy,
  clusterRedisLLen,
  clusterRedisLPop,
  clusterRedisLRange,
  clusterRedisRPush,
  clusterRedisSAdd,
  clusterRedisSCard,
  clusterRedisSRem,
  clusterRedisSet,
  clusterRedisSetNxEx
} from '../clusterRedisState.js';
import { oneDriveStagingMountPath as stagingMountPath } from '../photoAlbumsOneDriveStagingRoot.js';

const ONEDRIVE_QUEUE_PREFIX = 'v1:photo_albums:onedrive:queue:';
const ONEDRIVE_QUEUED_SET_PREFIX = 'v1:photo_albums:onedrive:queued_set:';
const ONEDRIVE_INFLIGHT_PREFIX = 'v1:photo_albums:onedrive:inflight:';
const ONEDRIVE_INFLIGHT_PATH_PREFIX = 'v1:photo_albums:onedrive:inflight_path:';
const ONEDRIVE_PUMP_LOCK_PREFIX = 'v1:photo_albums:onedrive:pump_lock:';
const ONEDRIVE_MOUNT_PREFIX = 'v1:photo_albums:onedrive:queue_mount:';

function onedriveQueueKey(singlesId) {
  return `${ONEDRIVE_QUEUE_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function onedriveQueuedSetKey(singlesId) {
  return `${ONEDRIVE_QUEUED_SET_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function onedriveInflightKey(singlesId) {
  return `${ONEDRIVE_INFLIGHT_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function onedriveInflightPathKey(singlesId) {
  return `${ONEDRIVE_INFLIGHT_PATH_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function onedrivePumpLockKey(singlesId) {
  return `${ONEDRIVE_PUMP_LOCK_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function onedriveMountKey(singlesId) {
  return `${ONEDRIVE_MOUNT_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function readValidatedVaultDbBuffer(absPath, meta) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing local vault database: ${path.basename(absPath)}`);
  }
  const buf = fs.readFileSync(absPath);
  const expectSqlite = !useEncryptedVaultFilenames(meta);
  if (expectSqlite && !isSqliteVaultDbBuffer(buf)) {
    throw new Error(
      `Local ${path.basename(absPath)} is not valid SQLite (${buf.length} bytes) — refusing OneDrive upload`
    );
  }
  rvCloudLog('OneDrive', 'validated vault db for upload', {
    file: path.basename(absPath),
    bytes: buf.length,
    sqlite: isSqliteVaultDbBuffer(buf)
  });
  return buf;
}

async function countPendingOneDriveUploads(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return 0;
  const inflight = await clusterRedisGetInt(onedriveInflightKey(id));
  // Prefer unique queued-set cardinality; fall back to list length for older queues.
  let queued = await clusterRedisSCard(onedriveQueuedSetKey(id));
  if (queued <= 0) {
    queued = await clusterRedisLLen(onedriveQueueKey(id));
  }
  return Math.max(0, Number(inflight) || 0) + Math.max(0, Number(queued) || 0);
}

function basenameForUploadLabel(relPath) {
  const rel = String(relPath || '').trim();
  if (!rel) return '';
  return path.basename(rel) || rel;
}

/**
 * Pending async uploads: currently uploading file + queued file basenames.
 * @returns {{ remaining: number, currentName: string, queuedNames: string[], labelNames: string[] }}
 */
async function listPendingOneDriveUploadNames(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return { remaining: 0, currentName: '', queuedNames: [], labelNames: [] };
  }
  const currentRaw = String((await clusterRedisGet(onedriveInflightPathKey(id))) || '').trim();
  const currentName = basenameForUploadLabel(currentRaw);
  const queuedRels = await clusterRedisLRange(onedriveQueueKey(id), 0, 19);
  const queuedNames = queuedRels.map(basenameForUploadLabel).filter(Boolean);
  const labelNames = [];
  if (currentName) labelNames.push(currentName);
  for (const name of queuedNames) {
    if (!labelNames.includes(name)) labelNames.push(name);
  }
  const remaining = await countPendingOneDriveUploads(id);
  return { remaining, currentName, queuedNames, labelNames };
}

function formatPendingUploadProgressLabel({ remaining, currentName, labelNames }) {
  const left = Math.max(0, Number(remaining) || 0);
  if (left <= 0) return 'Uploads finished';
  const names = Array.isArray(labelNames) ? labelNames.filter(Boolean) : [];
  const primary = String(currentName || names[0] || '').trim();
  const uniqueLeft = Math.max(left, names.length);
  if (!primary) {
    return `Uploading ${uniqueLeft} changed file${uniqueLeft === 1 ? '' : 's'}…`;
  }
  if (uniqueLeft <= 1 || names.length <= 1) {
    return `Uploading ${primary}…`;
  }
  const shown = names.slice(0, 3);
  const extra = Math.max(0, uniqueLeft - shown.length);
  if (extra > 0) {
    return `Uploading ${shown.join(', ')} (+${extra} more changed)…`;
  }
  return `Uploading ${shown.join(', ')}…`;
}

/**
 * Wait for in-flight OneDrive file uploads before logoff full sync.
 * @param {number} singlesId
 * @param {{ onProgress?: (p: { initial: number, remaining: number, currentName?: string, labelNames?: string[], label?: string }) => (void|Promise<void>) }} [opts]
 */
export async function drainPendingOneDriveUploads(singlesId, { onProgress } = {}) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return { initial: 0 };
  const initialNames = await listPendingOneDriveUploadNames(id);
  const initial = Math.max(initialNames.remaining, await countPendingOneDriveUploads(id));
  const quotaExhausted = await isVaultTransferQuotaExhausted(id);
  const refillHint = quotaExhausted ? `\n${getVaultTransferThrottleRefillLabel()}` : '';
  const withRefillHint = (label) => {
    const base = String(label || '').trim();
    if (!refillHint) return base;
    if (!base) return getVaultTransferThrottleRefillLabel();
    if (base.includes('Data Transfer Refill Depleted') || base.includes('Remain Transfer Data exceeded') || base.includes('\n')) return base;
    return `${base}${refillHint}`;
  };
  if (initial > 0 && onProgress) {
    await onProgress({
      initial,
      remaining: initial,
      currentName: initialNames.currentName,
      labelNames: initialNames.labelNames,
      label: withRefillHint(formatPendingUploadProgressLabel(initialNames))
    });
  }
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const pending = await listPendingOneDriveUploadNames(id);
    const remaining = pending.remaining;
    if (onProgress) {
      await onProgress({
        initial: Math.max(initial, remaining),
        remaining,
        currentName: pending.currentName,
        labelNames: pending.labelNames,
        label: withRefillHint(formatPendingUploadProgressLabel(pending))
      });
    }
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const remaining = await clusterRedisGetInt(onedriveInflightKey(id));
  if (remaining > 0) {
    rvCloudWarn('OneDrive', 'drain timeout with uploads still in flight', { singlesId: id, remaining });
  }
  return { initial };
}

async function pumpOneDriveUploadQueue(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  const lockKey = onedrivePumpLockKey(id);
  const acquired = await clusterRedisSetNxEx(lockKey, String(process.pid), 300);
  if (!acquired) return;
  try {
    let rel = await clusterRedisLPop(onedriveQueueKey(id));
    while (rel) {
      await clusterRedisSRem(onedriveQueuedSetKey(id), rel);
      const mountPath = String((await clusterRedisGet(onedriveMountKey(id))) || '').trim();
      if (!mountPath) break;
      await clusterRedisIncrBy(onedriveInflightKey(id), 1);
      await clusterRedisSet(onedriveInflightPathKey(id), String(rel), 600);
      try {
        await uploadOneDriveStagingRelativeFile(id, mountPath, rel);
      } catch (err) {
        rvCloudWarn('OneDrive', 'queued upload failed — path stays dirty for logoff retry', {
          singlesId: id,
          rel,
          message: err?.message || String(err)
        });
      } finally {
        await clusterRedisDel(onedriveInflightPathKey(id));
        await clusterRedisIncrBy(onedriveInflightKey(id), -1);
      }
      rel = await clusterRedisLPop(onedriveQueueKey(id));
    }
  } finally {
    await clusterRedisDel(lockKey);
    const queued =
      (await clusterRedisSCard(onedriveQueuedSetKey(id))) || (await clusterRedisLLen(onedriveQueueKey(id)));
    if (queued > 0) {
      void pumpOneDriveUploadQueue(id);
    }
  }
}

const ONEDRIVE_LEGACY_INNER_PREFIX = '.recordvault';

async function findOneDriveVaultDbItem(accessToken, folderId, meta = null) {
  for (const fileName of listVaultDbFileNamesForRead(meta)) {
    for (const prefix of ['', `${ONEDRIVE_LEGACY_INNER_PREFIX}/`]) {
      const rel = `${prefix}${fileName}`;
      const item = await getOneDriveItemAtPath(accessToken, folderId, rel, 'id');
      if (item?.id) return { item, fileName, rel };
    }
  }
  return null;
}

function oneDriveVaultMetaRelativePaths() {
  return [VAULT_META_FILE, `${ONEDRIVE_LEGACY_INNER_PREFIX}/${VAULT_META_FILE}`];
}

async function oneDriveFolderHasCompleteVault(accessToken, folderId, meta = null) {
  if (!(await oneDriveFolderHasVaultMeta(accessToken, folderId))) return false;
  const dbFound = await findOneDriveVaultDbItem(accessToken, folderId, meta);
  return Boolean(dbFound?.item?.id);
}

const TEST_WRITE_FILE_NAME = 'test.txt';
const TEST_WRITE_FILE_BODY = 'test.txt';

/**
 * Ensure onlinemallwebsitevault exists with files/, photos/, vault.meta.json, and vault.db(.enc).
 * When icon encryption is on but no key is available yet, creates folder layout only.
 * @param {Buffer|null|{key:Buffer,kdfSalt?:string,kdf?:string}} keyOrMaterial
 */
export async function formatEmptyOneDriveVaultFolderIfNeeded(singlesId, accessToken, folderId, keyOrMaterial = null) {
  if (!folderId) return { formatted: false, reason: 'no_folder' };

  if (await oneDriveFolderHasCompleteVault(accessToken, folderId)) {
    return { formatted: false, reason: 'already_formatted' };
  }

  await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_PHOTOS_DIR]);
  await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_FILES_DIR]);

  let key = null;
  let kdfMaterial = null;
  if (Buffer.isBuffer(keyOrMaterial)) {
    key = keyOrMaterial;
  } else if (keyOrMaterial?.key) {
    key = keyOrMaterial.key;
    kdfMaterial = keyOrMaterial;
  }

  const effectiveKey = isPhotoAlbumsIconEncryptionEnabled() ? key : null;
  if (isPhotoAlbumsIconEncryptionEnabled() && isPlaintextVaultKey(effectiveKey)) {
    rvCloudLog('OneDrive', 'vault folder layout ready — awaiting icon for db/meta', {
      singlesId,
      folderId,
      folderName: getOneDriveVaultFolderName()
    });
    return { formatted: false, reason: 'layout_only', folderId };
  }

  const mountPath = stagingMountPath(singlesId);
  fs.rmSync(mountPath, { recursive: true, force: true });
  await initializeVaultOnUsbWithKey(mountPath, effectiveKey, kdfMaterial);
  await uploadOneDriveVaultEssentials(singlesId, mountPath);

  const meta = readVaultMeta(mountPath);
  if (useEncryptedVaultFilenames(meta)) {
    await upsertOneDriveFileAtPath(
      accessToken,
      folderId,
      TEST_WRITE_FILE_NAME,
      Buffer.from(TEST_WRITE_FILE_BODY, 'utf8'),
      'text/plain'
    );
  }

  rvCloudLog('OneDrive', 'auto-formatted empty OneDrive vault folder', {
    singlesId,
    folderId,
    folderName: getOneDriveVaultFolderName(),
    dbFileName: getVaultDbFileName(meta),
    encrypted: useEncryptedVaultFilenames(meta)
  });
  return { formatted: true, folderId };
}

async function oneDriveFolderHasVaultMeta(accessToken, folderId) {
  if (!folderId) return false;
  for (const rel of oneDriveVaultMetaRelativePaths()) {
    const item = await getOneDriveItemAtPath(accessToken, folderId, rel, 'id');
    if (item?.id) return true;
  }
  return false;
}

async function findOneDriveVaultRootFolderWithMeta(accessToken) {
  // Only the Photo Albums folder name — never discover TutaNotes / Notes vaults.
  const folderName = getOneDriveVaultFolderName();
  const folder = await findOneDriveItemByName(accessToken, 'root', folderName, true);
  if (!folder?.id) return null;
  if (await oneDriveFolderHasVaultMeta(accessToken, folder.id)) {
    rvCloudLog('OneDrive', 'found vault folder with meta at drive root', {
      folderId: folder.id,
      folderName
    });
    return folder.id;
  }
  return folder.id;
}

async function downloadOneDriveVaultMetaToStaging(accessToken, folderId, vaultRoot) {
  let lastErr = null;
  for (const rel of oneDriveVaultMetaRelativePaths()) {
    try {
      const buf = await downloadOneDriveFileAtPath(accessToken, folderId, rel);
      fs.mkdirSync(vaultRoot, { recursive: true });
      fs.writeFileSync(path.join(vaultRoot, VAULT_META_FILE), buf);
      return parseVaultMetaBuffer(buf);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Missing ${VAULT_META_FILE} in OneDrive folder ${getOneDriveVaultFolderName()}`);
}

async function downloadOneDriveVaultDb(accessToken, folderId, vaultRoot, meta = null, opts = {}) {
  const dbNames = listVaultDbFileNamesForRead(meta);
  const expectSqlite = !useEncryptedVaultFilenames(meta);
  const reportFile = typeof opts?.onProgress === 'function' ? opts.onProgress : null;
  let lastErr = null;
  for (const fileName of dbNames) {
    if (reportFile) {
      try {
        await reportFile(fileName);
      } catch {
        // Progress UI must never fail vault open.
      }
    }
    for (const prefix of ['', `${ONEDRIVE_LEGACY_INNER_PREFIX}/`]) {
      const rel = `${prefix}${fileName}`;
      try {
        const buf = await downloadOneDriveFileAtPath(accessToken, folderId, rel);
        if (expectSqlite && !isSqliteVaultDbBuffer(buf)) {
          rvCloudWarn('OneDrive', 'downloaded vault db is not SQLite — trying next path', {
            rel,
            byteLength: buf?.length ?? 0
          });
          continue;
        }
        if (!buf?.length) {
          rvCloudWarn('OneDrive', 'downloaded vault db is empty — trying next path', { rel });
          continue;
        }
        fs.writeFileSync(path.join(vaultRoot, fileName), buf);
        rvCloudLog('OneDrive', 'downloaded vault db', { rel, fileName, encrypted: !expectSqlite });
        return fileName;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw lastErr || new Error(`Missing vault database in OneDrive folder ${getOneDriveVaultFolderName()}`);
}

function walkLocalFiles(dirPath, basePath = dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = [];
  for (const name of fs.readdirSync(dirPath)) {
    const abs = path.join(dirPath, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      entries.push(...walkLocalFiles(abs, basePath));
    } else {
      entries.push(path.relative(basePath, abs).split(path.sep).join('/'));
    }
  }
  return entries;
}

async function resolveOneDriveVaultFolderId(singlesId, accessToken, conn) {
  const storedId = String(conn?.folderId || '').trim();
  const expectedName = getOneDriveVaultFolderName();

  // Keep stored folder only when it is the Photo Albums root (name match). Never reuse TutaNotes.
  if (storedId) {
    try {
      const item = await getOneDriveItem(accessToken, storedId, 'id,name,folder');
      const name = String(item?.name || '').trim();
      if (item?.folder && name === expectedName) {
        return storedId;
      }
      rvCloudWarn('OneDrive', 'stored folderId is not Photo Albums root — recreating expected folder', {
        storedId,
        name: name || null,
        expected: expectedName
      });
    } catch (err) {
      const msg = String(err?.message || '');
      if (!/not be found|itemnotfound|resource could not be found/i.test(msg)) {
        throw err;
      }
      rvCloudWarn('OneDrive', 'stored folderId missing on OneDrive — searching drive root', {
        storedId,
        expected: expectedName,
        msg
      });
    }
  }

  const vaultFolderId = await findOneDriveVaultRootFolderWithMeta(accessToken);
  const resolvedId = vaultFolderId || (await ensureVaultRootFolder(accessToken));
  if (resolvedId !== storedId) {
    await saveOneDriveConnection(singlesId, {
      refreshToken: conn.refreshToken,
      folderId: resolvedId,
      email: conn.email
    });
    rvCloudLog('OneDrive', 'resolved OneDrive vault folderId', {
      singlesId,
      previousFolderId: storedId || null,
      folderId: resolvedId,
      folderName: expectedName,
      foundExistingVault: Boolean(vaultFolderId)
    });
  }
  return resolvedId;
}

export async function getAccessTokenForSingles(singlesId, { conn: connIn } = {}) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }

  const cached = await getCachedOneDriveAuth(id);
  if (cached?.accessToken && cached?.folderId) {
    return { accessToken: cached.accessToken, folderId: cached.folderId, email: cached.email };
  }

  const conn = connIn || (await loadOneDriveConnection(id));
  if (!conn?.refreshToken) {
    throw new Error('OneDrive is not connected for this account');
  }
  const tokens = await refreshOneDriveAccessToken(conn.refreshToken);
  const accessToken = String(tokens?.access_token || '').trim();
  if (!accessToken) {
    throw new Error('Unable to obtain OneDrive access token');
  }
  const rotatedRefresh = String(tokens?.refresh_token || '').trim();
  const effectiveConn = {
    ...conn,
    refreshToken: rotatedRefresh || conn.refreshToken
  };
  if (rotatedRefresh) {
    await saveOneDriveConnection(id, {
      refreshToken: rotatedRefresh,
      folderId: conn.folderId,
      email: conn.email
    });
  }
  const folderId = await resolveOneDriveVaultFolderId(id, accessToken, effectiveConn);
  await setCachedOneDriveAuth(id, {
    accessToken,
    folderId,
    email: conn.email,
    expiresInSec: tokens?.expires_in
  });
  return { accessToken, folderId, email: conn.email };
}

async function ensureOneDriveFolderPath(accessToken, rootFolderId, parts) {
  let parentId = rootFolderId;
  for (const part of parts) {
    if (!part) continue;
    const existing = await findOneDriveItemByName(accessToken, parentId, part, true);
    if (existing?.id) {
      parentId = existing.id;
      continue;
    }
    parentId = await createOneDriveFolder(accessToken, parentId, part);
    if (!parentId) throw new Error('Failed to create OneDrive folder');
  }
  return parentId;
}

async function downloadOneDriveTree(accessToken, folderId, localRoot) {
  fs.mkdirSync(localRoot, { recursive: true });
  const children = await listOneDriveChildren(accessToken, folderId);
  for (const child of children) {
    const name = String(child?.name || '');
    if (!name) continue;
    const localPath = path.join(localRoot, name);
    if (child.folder) {
      fs.mkdirSync(localPath, { recursive: true });
      await downloadOneDriveTree(accessToken, child.id, localPath);
      continue;
    }
    const buf = await downloadOneDriveFile(accessToken, child.id);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buf);
  }
}

/** Graph children listing can miss items — always fetch vault essentials by name. */
async function ensureOneDriveVaultEssentialFiles(accessToken, folderId, vaultRoot) {
  const meta = await downloadOneDriveVaultMetaToStaging(accessToken, folderId, vaultRoot);
  await downloadOneDriveVaultDb(accessToken, folderId, vaultRoot, meta);
}

export const ONEDRIVE_VAULT_REFORMAT_MESSAGE =
  'This OneDrive vault is unreadable or uses an older format. Click Format OneDrive vault, then Create on One Drive again.';

function parseVaultMetaBuffer(buf) {
  try {
    let raw = buf.toString('utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function classifyOneDriveVaultMeta(meta) {
  if (!meta?.vaultId) return { valid: false, reason: 'missing_vault_id' };
  if (Number(meta.version) === 1) return { valid: true, legacyPinVault: true };
  if (vaultMetaUsesPlaintextStorage(meta)) return { valid: true, plaintext: true };
  if (Number(meta.version) === 2 && meta.encryption === 'aes-256-gcm-icon-key') {
    return { valid: true, iconEncrypted: true };
  }
  return { valid: false, reason: 'unsupported_format' };
}

export function assertOneDriveStagingVaultReady(mountPath) {
  const meta = readVaultMeta(mountPath);
  if (!meta?.vaultId) {
    throw new Error(ONEDRIVE_VAULT_REFORMAT_MESSAGE);
  }
  const check = validateVaultOnMount(mountPath);
  if (!check.ok) {
    const detail = String(check.error || '');
    if (/vault\.meta\.json/i.test(detail) || /Missing required file: vault\.meta/i.test(detail)) {
      throw new Error(ONEDRIVE_VAULT_REFORMAT_MESSAGE);
    }
    throw new Error(detail || 'Invalid OneDrive vault');
  }
  const root = vaultRootOnMount(mountPath);
  const preferredName = getVaultDbFileName(meta);
  const dbPath = path.join(root, preferredName);
  const encryptedStorage = useEncryptedVaultFilenames(meta);

  if (!encryptedStorage && !isSqliteVaultDbFile(dbPath)) {
    for (const altName of listVaultDbFileNamesForRead(meta)) {
      if (altName === preferredName) continue;
      const altPath = path.join(root, altName);
      if (!isSqliteVaultDbFile(altPath)) continue;
      fs.renameSync(altPath, dbPath);
      rvCloudLog('OneDrive', 'staging heal — renamed alternate vault db to preferred name', {
        from: altName,
        to: preferredName
      });
      break;
    }
  }

  if (encryptedStorage) {
    let size = 0;
    try {
      size = fs.statSync(dbPath).size;
    } catch {
      size = 0;
    }
    if (size <= 0) {
      throw new Error(ONEDRIVE_VAULT_REFORMAT_MESSAGE);
    }
    return meta;
  }
  if (!isSqliteVaultDbFile(dbPath)) {
    rvCloudWarn('OneDrive', 'staging vault.db is not readable SQLite after download', {
      mountPath,
      dbPath
    });
    throw new Error(ONEDRIVE_VAULT_REFORMAT_MESSAGE);
  }
  return meta;
}

/**
 * @param {number} singlesId
 * @param {{ accessToken?: string, folderId?: string, conn?: unknown }|null} [authIn]
 * @param {{ onProgress?: (p: { percent: number, label?: string }) => (void|Promise<void>) }} [opts]
 */
export async function downloadVaultToStaging(singlesId, authIn = null, opts = {}) {
  const rawOnProgress = typeof opts?.onProgress === 'function' ? opts.onProgress : null;
  const onProgress = rawOnProgress
    ? async (payload) => {
        try {
          await rawOnProgress(payload);
        } catch {
          // Progress UI must never fail vault open.
        }
      }
    : null;

  if (onProgress) await onProgress({ percent: 5, label: 'Connecting to OneDrive' });
  let accessToken = authIn?.accessToken;
  let folderId = authIn?.folderId;
  if (!accessToken || !folderId) {
    const auth = await getAccessTokenForSingles(singlesId, { conn: authIn?.conn });
    accessToken = auth.accessToken;
    folderId = auth.folderId;
  }
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up');
  }
  if (onProgress) await onProgress({ percent: 15, label: 'Preparing local vault folder' });
  const mountPath = stagingMountPath(singlesId);
  fs.rmSync(mountPath, { recursive: true, force: true });
  const vaultRoot = vaultRootOnMount(mountPath);
  fs.mkdirSync(vaultRoot, { recursive: true });

  // Same pattern as Test Write: resolve folderId, then fetch named files by path.
  if (onProgress) {
    await onProgress({ percent: 30, label: `Loading file: ${VAULT_META_FILE}` });
  }
  const meta = await downloadOneDriveVaultMetaToStaging(accessToken, folderId, vaultRoot);
  const dbCandidates = listVaultDbFileNamesForRead(meta);
  const dbHint = dbCandidates[0] || 'vault.db';
  if (onProgress) {
    await onProgress({ percent: 55, label: `Loading file: ${dbHint}` });
  }
  const dbFileName = await downloadOneDriveVaultDb(accessToken, folderId, vaultRoot, meta, {
    onProgress: async (fileName) => {
      if (onProgress) {
        await onProgress({ percent: 55, label: `Loading file: ${fileName}` });
      }
    }
  });
  if (onProgress && dbFileName && dbFileName !== dbHint) {
    await onProgress({ percent: 75, label: `Loaded file: ${dbFileName}` });
  }
  if (onProgress) await onProgress({ percent: 80, label: 'Validating vault files' });
  ensureVaultLayoutDirs(mountPath);
  normalizeVaultStagingFilenames(mountPath);
  assertOneDriveStagingVaultReady(mountPath);

  // Track only files just downloaded (meta + db). Avoid walking media trees — open is db-only.
  let transferBytes = 0;
  try {
    transferBytes += fs.statSync(path.join(vaultRoot, VAULT_META_FILE)).size;
  } catch {
    // ignore
  }
  if (dbFileName) {
    try {
      transferBytes += fs.statSync(path.join(vaultRoot, dbFileName)).size;
    } catch {
      // ignore
    }
  }
  // Count open download toward quota, but never throttle here — only after
  // the user is inside the OneDrive / USB workspace (lazy media, save, logoff).
  await trackVaultTransferBytes(singlesId, transferBytes);
  if (onProgress) await onProgress({ percent: 90, label: 'Unlocking vault' });
  rvCloudLog('OneDrive', 'downloadVaultToStaging complete (db only — media lazy)', {
    singlesId,
    folderId,
    folderName: getOneDriveVaultFolderName()
  });
  return { mountPath, folderId, accessToken };
}

/** Pull photos/ and files/ from OneDrive into local staging (needed after logoff cleared staging). */
async function downloadOneDriveVaultMediaFolder(accessToken, folderId, dirName, localDir) {
  let folder = await getOneDriveItemAtPath(accessToken, folderId, dirName, 'id,folder');
  if (!folder?.id) {
    const children = await listOneDriveChildren(accessToken, folderId);
    folder = children.find((item) => String(item?.name || '') === dirName && item?.folder) || null;
  }
  if (!folder?.id) return false;
  fs.mkdirSync(localDir, { recursive: true });
  await downloadOneDriveTree(accessToken, folder.id, localDir);
  rvCloudLog('OneDrive', 'downloaded vault media folder', { dirName, itemId: folder.id });
  return true;
}

let oneDriveSqlJsPromise = null;
async function getOneDriveSqlJs() {
  if (!oneDriveSqlJsPromise) oneDriveSqlJsPromise = initSqlJs();
  return oneDriveSqlJsPromise;
}

function collectImageRelativePathsFromVaultDb(db) {
  const paths = new Set();
  const stmt = db.prepare(
    `SELECT image_relative_path, image_top_relative_path, image_bottom_relative_path
       FROM notes WHERE deleted_at IS NULL`
  );
  while (stmt.step()) {
    const row = stmt.getAsObject();
    for (const key of ['image_relative_path', 'image_top_relative_path', 'image_bottom_relative_path']) {
      const rel = String(row[key] || '').trim();
      if (rel) paths.add(rel);
    }
  }
  stmt.free();
  try {
    const extraStmt = db.prepare(
      `SELECT relative_path FROM note_extra_images WHERE deleted_at IS NULL`
    );
    while (extraStmt.step()) {
      const rel = String(extraStmt.getAsObject().relative_path || '').trim();
      if (rel) paths.add(rel);
    }
    extraStmt.free();
  } catch {
    // Older vault.db files may not have note_extra_images yet — ignore until unlock migrates.
  }
  return [...paths];
}

/** Download note images listed in vault.db (path-based — reliable when folder tree listing misses files). */
async function downloadOneDriveVaultPhotosFromDb(accessToken, folderId, mountPath, meta) {
  if (useEncryptedVaultFilenames(meta)) {
    // Encrypted vault.db.enc cannot be read until unlock — photos/ tree download covers media.
    rvCloudLog('OneDrive', 'skipped db photo index — vault db is encrypted until icon unlock');
    return;
  }
  const vaultRoot = vaultRootOnMount(mountPath);
  const dbAbs = path.join(vaultRoot, getVaultDbFileName(meta));
  if (!fs.existsSync(dbAbs)) return;

  const rawBuf = fs.readFileSync(dbAbs);
  if (!isSqliteVaultDbBuffer(rawBuf)) {
    rvCloudWarn('OneDrive', 'skipped db photo index — local vault db is not readable SQLite', {
      dbFile: path.basename(dbAbs),
      byteLength: rawBuf.length
    });
    return;
  }

  const SQL = await getOneDriveSqlJs();
  const db = new SQL.Database(rawBuf);
  let relPaths = [];
  try {
    relPaths = collectImageRelativePathsFromVaultDb(db);
  } finally {
    db.close();
  }

  for (const rel of relPaths) {
    const storageRel = vaultPhotoStorageRelativePath(rel, meta);
    const localAbs = path.join(vaultPhotosRoot(mountPath), storageRel);
    if (fs.existsSync(localAbs)) continue;

    const cloudCandidates = [
      `${VAULT_PHOTOS_DIR}/${storageRel}`,
      `${VAULT_PHOTOS_DIR}/${rel}`,
      `${VAULT_PHOTOS_DIR}/${rel}.enc`,
      `${VAULT_PHOTOS_DIR}/${storageRel}.enc`
    ];

    let downloaded = false;
    for (const cloudPath of cloudCandidates) {
      try {
        const buf = await downloadOneDriveFileAtPath(accessToken, folderId, cloudPath);
        fs.mkdirSync(path.dirname(localAbs), { recursive: true });
        fs.writeFileSync(localAbs, buf);
        rvCloudLog('OneDrive', 'downloaded vault photo from db path', { cloudPath, bytes: buf.length });
        downloaded = true;
        break;
      } catch {
        // try next candidate path
      }
    }
    if (!downloaded) {
      rvCloudWarn('OneDrive', 'vault photo missing on OneDrive for db path', { rel, storageRel });
    }
  }
}

async function downloadOneDriveVaultPhotoByRelativePath(
  singlesId,
  accessToken,
  folderId,
  mountPath,
  relativePath,
  meta
) {
  const rel = String(relativePath || '').trim();
  if (!rel) return false;
  const storageRel = vaultPhotoStorageRelativePath(rel, meta);
  const localAbs = path.join(vaultPhotosRoot(mountPath), storageRel);
  if (fs.existsSync(localAbs)) return true;

  const cloudCandidates = [
    `${VAULT_PHOTOS_DIR}/${storageRel}`,
    `${VAULT_PHOTOS_DIR}/${rel}`,
    `${VAULT_PHOTOS_DIR}/${rel}.enc`,
    `${VAULT_PHOTOS_DIR}/${storageRel}.enc`
  ];

  for (const cloudPath of cloudCandidates) {
    try {
      const transferStartedAt = Date.now();
      const buf = await downloadOneDriveFileAtPath(accessToken, folderId, cloudPath);
      fs.mkdirSync(path.dirname(localAbs), { recursive: true });
      fs.writeFileSync(localAbs, buf);
      await trackVaultTransferBytes(singlesId, buf.length, transferStartedAt);
      rvCloudLog('OneDrive', 'lazy-downloaded vault photo', { cloudPath, bytes: buf.length });
      return true;
    } catch {
      // try next candidate path
    }
  }
  rvCloudWarn('OneDrive', 'vault photo missing on OneDrive for lazy path', { rel, storageRel });
  return false;
}

async function downloadOneDriveVaultFileByRelativePath(
  singlesId,
  accessToken,
  folderId,
  mountPath,
  relativePath,
  meta
) {
  const rel = String(relativePath || '').trim();
  if (!rel) return false;
  const storageRel = vaultFileStorageRelativePath(rel, meta);
  const localAbs = path.join(vaultFilesRoot(mountPath), storageRel);
  if (fs.existsSync(localAbs)) return true;

  const cloudCandidates = [
    `${VAULT_FILES_DIR}/${storageRel}`,
    `${VAULT_FILES_DIR}/${rel}`,
    `${VAULT_FILES_DIR}/${rel}.enc`,
    `${VAULT_FILES_DIR}/${storageRel}.enc`
  ];

  for (const cloudPath of cloudCandidates) {
    try {
      const transferStartedAt = Date.now();
      const buf = await downloadOneDriveFileAtPath(accessToken, folderId, cloudPath);
      fs.mkdirSync(path.dirname(localAbs), { recursive: true });
      fs.writeFileSync(localAbs, buf);
      await trackVaultTransferBytes(singlesId, buf.length, transferStartedAt);
      rvCloudLog('OneDrive', 'lazy-downloaded vault file', { cloudPath, bytes: buf.length });
      return true;
    } catch {
      // try next candidate path
    }
  }
  rvCloudWarn('OneDrive', 'vault file missing on OneDrive for lazy path', { rel, storageRel });
  return false;
}

/** Pull one encrypted photo from OneDrive when absent from local staging. */
export async function ensureOneDriveVaultPhotoOnDisk(singlesId, mountPath, relativePath, meta = null) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const rel = String(relativePath || '').trim();
  if (!rel) return false;
  const resolvedMeta = meta ?? readVaultMeta(mountPath);
  const storageRel = vaultPhotoStorageRelativePath(rel, resolvedMeta);
  const localAbs = path.join(vaultPhotosRoot(mountPath), storageRel);
  if (fs.existsSync(localAbs)) return true;
  const { accessToken, folderId } = await getAccessTokenForSingles(id);
  if (!folderId) return false;
  return downloadOneDriveVaultPhotoByRelativePath(id, accessToken, folderId, mountPath, rel, resolvedMeta);
}

/** Pull one encrypted attachment from OneDrive when absent from local staging. */
export async function ensureOneDriveVaultFileOnDisk(singlesId, mountPath, relativePath, meta = null) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const rel = String(relativePath || '').trim();
  if (!rel) return false;
  const resolvedMeta = meta ?? readVaultMeta(mountPath);
  const storageRel = vaultFileStorageRelativePath(rel, resolvedMeta);
  const localAbs = path.join(vaultFilesRoot(mountPath), storageRel);
  if (fs.existsSync(localAbs)) return true;
  const { accessToken, folderId } = await getAccessTokenForSingles(id);
  if (!folderId) return false;
  return downloadOneDriveVaultFileByRelativePath(id, accessToken, folderId, mountPath, rel, resolvedMeta);
}

async function downloadOneDriveVaultMediaToStaging(accessToken, folderId, mountPath) {
  const vaultRoot = vaultRootOnMount(mountPath);
  for (const dirName of [VAULT_PHOTOS_DIR, VAULT_FILES_DIR]) {
    const localDir = path.join(vaultRoot, dirName);
    await downloadOneDriveVaultMediaFolder(accessToken, folderId, dirName, localDir);
  }
}

/** Skip PUT when remote file exists with same byte size as local buffer. */
async function upsertOneDriveFileIfChanged(
  accessToken,
  folderId,
  relativePath,
  buffer,
  mimeType = 'application/octet-stream'
) {
  const localSize = buffer?.length ?? 0;
  const remote = await getOneDriveItemAtPath(accessToken, folderId, relativePath, 'id,name,size,file');
  const remoteSize = Number(remote?.file?.size);
  if (remote?.file && Number.isFinite(remoteSize) && remoteSize === localSize) {
    rvCloudLog('OneDrive', 'skipped upload — remote size matches local', {
      rel: relativePath,
      bytes: localSize
    });
    return { uploaded: false, skipped: true };
  }
  await upsertOneDriveFileAtPath(accessToken, folderId, relativePath, buffer, mimeType);
  return { uploaded: true, skipped: false };
}

async function uploadOneDriveVaultEssentialsInternal(
  singlesId,
  mountPath,
  accessToken,
  folderId,
  { uploadMeta = true, uploadDb = true, skipIfUnchanged = false, onProgress } = {}
) {
  const vaultRoot = vaultRootOnMount(mountPath);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error('Local vault folder is missing');
  }
  const metaPath = path.join(vaultRoot, VAULT_META_FILE);
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Missing local ${VAULT_META_FILE}`);
  }
  const meta = readVaultMeta(mountPath);
  const dbFileName = getVaultDbFileName(meta);
  const upsert = skipIfUnchanged ? upsertOneDriveFileIfChanged : async (...args) => {
    await upsertOneDriveFileAtPath(...args);
    return { uploaded: true, skipped: false };
  };
  const throttleProgress =
    typeof onProgress === 'function'
      ? {
          onProgress: async (payload) => {
            try {
              await onProgress(payload);
            } catch {
              // Progress UI must never fail vault sync.
            }
          }
        }
      : {};

  if (uploadMeta) {
    const metaBuf = fs.readFileSync(metaPath);
    const transferStartedAt = Date.now();
    const result = await upsert(accessToken, folderId, VAULT_META_FILE, metaBuf, 'application/json');
    if (result.uploaded) {
      await trackVaultTransferBytes(singlesId, metaBuf.length, transferStartedAt, throttleProgress);
      rvCloudLog('OneDrive', 'uploaded vault essential', { fileName: VAULT_META_FILE, folderId });
    }
  }

  if (uploadDb) {
    const dbAbs = path.join(vaultRoot, dbFileName);
    const dbBuf = readValidatedVaultDbBuffer(dbAbs, meta);
    const transferStartedAt = Date.now();
    const result = await upsert(accessToken, folderId, dbFileName, dbBuf, 'application/x-sqlite3');
    if (result.uploaded) {
      await trackVaultTransferBytes(singlesId, dbBuf.length, transferStartedAt, throttleProgress);
      rvCloudLog('OneDrive', 'uploaded vault essential', { fileName: dbFileName, folderId });
    }
  }

  if (!useEncryptedVaultFilenames(meta)) {
    for (const legacyName of listVaultDbFileNames()) {
      if (legacyName === dbFileName) continue;
      try {
        await deleteOneDriveItemAtPath(accessToken, folderId, legacyName);
      } catch {
        // ignore if legacy name absent
      }
    }
  }
  await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_PHOTOS_DIR]);
  await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_FILES_DIR]);
  return { folderId, dbFileName };
}

/** Upload vault.meta.json + vault DB to OneDrive root — same upsert path as Test Write. */
export async function uploadOneDriveVaultEssentials(singlesId, mountPath) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up');
  }
  return uploadOneDriveVaultEssentialsInternal(singlesId, mountPath, accessToken, folderId, {
    uploadMeta: true,
    uploadDb: true,
    skipIfUnchanged: false
  });
}

/** Upload only vault.meta.json — e.g. sync unlock-guard after a failed icon guess. */
export async function uploadOneDriveVaultMetaOnly(singlesId, mountPath) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up');
  }
  return uploadOneDriveVaultEssentialsInternal(singlesId, mountPath, accessToken, folderId, {
    uploadMeta: true,
    uploadDb: false,
    skipIfUnchanged: true
  });
}

export async function prepareEmptyOneDriveStaging(singlesId) {
  const mountPath = stagingMountPath(singlesId);
  fs.rmSync(mountPath, { recursive: true, force: true });
  fs.mkdirSync(vaultPhotosRoot(mountPath), { recursive: true });
  fs.mkdirSync(vaultFilesRoot(mountPath), { recursive: true });
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  return { mountPath, folderId, accessToken };
}

export async function uploadVaultRootToOneDrive(singlesId, mountPath, folderId = null) {
  const { accessToken, folderId: resolvedFolderId } = await getAccessTokenForSingles(singlesId);
  const targetFolderId = resolvedFolderId || folderId;
  if (!targetFolderId) {
    throw new Error('OneDrive vault folder is not set up');
  }
  const vaultRoot = vaultRootOnMount(mountPath);
  if (!fs.existsSync(vaultRoot)) return;

  normalizeVaultStagingFilenames(mountPath);
  const meta = readVaultMeta(mountPath);
  const dbFileName = getVaultDbFileName(meta);

  // Essentials first — validated SQLite db + meta (logoff critical path).
  await uploadOneDriveVaultEssentials(singlesId, mountPath);

  const relFiles = walkLocalFiles(vaultRoot).filter((rel) => {
    if (rel === VAULT_META_FILE || rel === dbFileName) return false;
    if (!useEncryptedVaultFilenames(meta) && isVaultDbRelativePath(rel)) return false;
    if (!useEncryptedVaultFilenames(meta) && rel.endsWith('.enc')) return false;
    return true;
  });

  for (const rel of relFiles) {
    const abs = path.join(vaultRoot, rel);
    const buf = fs.readFileSync(abs);
    const transferStartedAt = Date.now();
    const result = await upsertOneDriveFileIfChanged(accessToken, targetFolderId, rel, buf);
    if (result.uploaded) {
      await trackVaultTransferBytes(singlesId, buf.length, transferStartedAt);
      rvCloudLog('OneDrive', 'uploaded vault file on full sync', { rel, bytes: buf.length });
    }
  }

  if (!useEncryptedVaultFilenames(meta)) {
    for (const legacyName of listVaultDbFileNames()) {
      if (legacyName === dbFileName) continue;
      try {
        await deleteOneDriveItemAtPath(accessToken, targetFolderId, legacyName);
      } catch {
        // ignore
      }
    }
    for (const rel of relFiles) {
      if (rel.endsWith('.enc')) continue;
      try {
        await deleteOneDriveItemAtPath(accessToken, targetFolderId, `${rel}.enc`);
      } catch {
        // ignore
      }
    }
  }
  await ensureOneDriveFolderPath(accessToken, targetFolderId, [VAULT_PHOTOS_DIR]);
  await ensureOneDriveFolderPath(accessToken, targetFolderId, [VAULT_FILES_DIR]);
}

/**
 * Soft percent heartbeat while a long OneDrive PUT is in flight (Graph has no byte callback).
 * Keeps the FE from sitting on one frozen % for minutes.
 */
async function withLogoffProgressHeartbeat(tick, workPromise, { intervalMs = 900 } = {}) {
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    void Promise.resolve()
      .then(() => tick())
      .catch(() => {});
  }, intervalMs);
  try {
    return await workPromise;
  } finally {
    stopped = true;
    clearInterval(timer);
  }
}

function formatLogoffBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n >= 1024 * 1024) {
    const mb = n / (1024 * 1024);
    const rounded = Math.abs(mb - Math.round(mb)) < 0.05 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return `${rounded}MB`;
  }
  if (n >= 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${Math.round(n)}B`;
}

/**
 * Logoff: drain async uploads, then sync only dirty essentials + media paths.
 * Progress uses phase bands so the UI moves during long Graph uploads (not only after each file).
 * @param {number} singlesId
 * @param {string} mountPath
 * @param {{
 *   dbDirty?: boolean,
 *   dirtyPaths?: string[],
 *   onProgress?: (p: { percent: number, label?: string, done?: number, total?: number }) => (void|Promise<void>)
 * }} [opts]
 */
export async function uploadOneDriveVaultOnLogoff(
  singlesId,
  mountPath,
  { dbDirty = false, dirtyPaths = [], onProgress } = {}
) {
  const vaultRoot = vaultRootOnMount(mountPath);
  if (!fs.existsSync(vaultRoot)) {
    if (onProgress) await onProgress({ percent: 100, label: 'Done', done: 1, total: 1 });
    return;
  }

  normalizeVaultStagingFilenames(mountPath);
  const meta = readVaultMeta(mountPath);
  const dbFileName = getVaultDbFileName(meta);

  const pathSet = new Set(
    (Array.isArray(dirtyPaths) ? dirtyPaths : []).map(normalizeOneDriveRelativePath).filter(Boolean)
  );
  const uploadMeta = pathSet.has(VAULT_META_FILE);
  const uploadDb = dbDirty || pathSet.has(dbFileName);
  const mediaPaths = [...pathSet].filter((rel) => rel !== VAULT_META_FILE && rel !== dbFileName);

  const pendingBeforeDrain = await countPendingOneDriveUploads(singlesId);
  const hasUploadWork = uploadMeta || uploadDb || mediaPaths.length > 0;
  let lastPercent = 1;

  const report = async (percent, label) => {
    if (!onProgress) return;
    const next = Math.max(lastPercent, Math.min(99, Math.round(Number(percent) || 0)));
    lastPercent = next;
    await onProgress({ percent: next, label: label || 'Saving to Cloud' });
  };

  await report(2, pendingBeforeDrain > 0 ? 'Waiting for Cloud uploads…' : 'Preparing Cloud save…');

  const drainStartedAt = Date.now();
  await drainPendingOneDriveUploads(singlesId, {
    onProgress: async ({ initial, remaining, label: pendingLabel }) => {
      const fromCount = initial > 0 ? 1 - remaining / initial : 1;
      // Crawl the drain band even if Redis counters stall (common cause of stuck 0%).
      const fromTime = Math.min(0.95, (Date.now() - drainStartedAt) / 90000);
      const frac = Math.max(fromCount, fromTime * 0.55);
      const pct = 5 + frac * 20;
      const label =
        remaining > 0
          ? pendingLabel || `Uploading files (${remaining} left)…`
          : 'Uploads finished';
      await report(pct, label);
    }
  });

  if (!hasUploadWork) {
    rvCloudLog('OneDrive', 'logoff sync skipped — no dirty files', { singlesId });
    clearAllOneDriveDirty(singlesId);
    if (onProgress) await onProgress({ percent: 100, label: 'Done — nothing new to upload' });
    return;
  }

  await report(28, 'Connecting to OneDrive…');
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up');
  }

  if (uploadMeta || uploadDb) {
    let dbBytes = 0;
    try {
      if (uploadDb) {
        const dbAbs = path.join(vaultRoot, dbFileName);
        if (fs.existsSync(dbAbs)) dbBytes = fs.statSync(dbAbs).size || 0;
      }
    } catch {
      dbBytes = 0;
    }
    const sizeHint = dbBytes > 0 ? ` (${formatLogoffBytes(dbBytes)})` : '';
    const essentialNames = [
      ...(uploadMeta ? [VAULT_META_FILE] : []),
      ...(uploadDb ? [dbFileName] : [])
    ];
    const essentialLabel =
      essentialNames.length > 0
        ? `Uploading file${essentialNames.length === 1 ? '' : 's'}: ${essentialNames.join(', ')}${sizeHint}…`
        : `Uploading vault database${sizeHint}…`;
    const quotaExhausted = await isVaultTransferQuotaExhausted(singlesId);
    const refillHint = quotaExhausted ? `\n${getVaultTransferThrottleRefillLabel()}` : '';
    const essentialProgressLabel = `${essentialLabel}${refillHint}`;
    await report(32, essentialProgressLabel);
    let soft = 32;
    const reportThrottle = async ({ label } = {}) => {
      soft = Math.min(58, soft + 0.5);
      await report(
        soft,
        `${essentialLabel}\n${label || getVaultTransferThrottleRefillLabel()}`
      );
    };
    try {
      await withLogoffProgressHeartbeat(async () => {
        soft = Math.min(58, soft + 1.5);
        await report(soft, essentialProgressLabel);
      }, uploadOneDriveVaultEssentialsInternal(singlesId, mountPath, accessToken, folderId, {
        uploadMeta,
        uploadDb,
        skipIfUnchanged: true,
        onProgress: reportThrottle
      }));
    } catch (err) {
      rvCloudWarn('OneDrive', 'logoff essentials upload failed', {
        singlesId,
        message: err?.message || String(err)
      });
    }
    await report(
      60,
      essentialNames.length > 0
        ? `Saved to Cloud: ${essentialNames.join(', ')}`
        : 'Vault database saved to OneDrive'
    );
  } else {
    await report(40, 'Preparing OneDrive folders…');
    await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_PHOTOS_DIR]);
    await ensureOneDriveFolderPath(accessToken, folderId, [VAULT_FILES_DIR]);
  }

  const mediaTotal = mediaPaths.length;
  const mediaQuotaExhausted = await isVaultTransferQuotaExhausted(singlesId);
  const mediaRefillHint = mediaQuotaExhausted ? `\n${getVaultTransferThrottleRefillLabel()}` : '';
  for (let i = 0; i < mediaPaths.length; i += 1) {
    const rel = mediaPaths[i];
    const fileLabel = path.basename(rel) || rel;
    const bandLo = 60;
    const bandHi = 94;
    const base = bandLo + (mediaTotal > 0 ? (i / mediaTotal) * (bandHi - bandLo) : 0);
    const mediaBaseLabel = `Uploading file ${i + 1} of ${mediaTotal}: ${fileLabel}`;
    await report(base, `${mediaBaseLabel}${mediaRefillHint}`);
    const abs = path.join(vaultRoot, rel);
    if (!fs.existsSync(abs)) {
      clearOneDrivePathDirty(singlesId, rel);
      continue;
    }
    try {
      const buf = fs.readFileSync(abs);
      const mimeType = isVaultDbRelativePath(rel) ? 'application/x-sqlite3' : 'application/octet-stream';
      const transferStartedAt = Date.now();
      let soft = base;
      const result = await withLogoffProgressHeartbeat(
        async () => {
          soft = Math.min(bandLo + ((i + 0.92) / Math.max(mediaTotal, 1)) * (bandHi - bandLo), soft + 1);
          await report(
            soft,
            `${mediaBaseLabel} (${formatLogoffBytes(buf.length)})…${mediaRefillHint}`
          );
        },
        upsertOneDriveFileIfChanged(accessToken, folderId, rel, buf, mimeType)
      );
      if (result.uploaded) {
        await trackVaultTransferBytes(singlesId, buf.length, transferStartedAt, {
          onProgress: async ({ label } = {}) => {
            soft = Math.min(bandHi, soft + 0.5);
            await report(
              soft,
              `${mediaBaseLabel}\n${label || getVaultTransferThrottleRefillLabel()}`
            );
          }
        });
        rvCloudLog('OneDrive', 'uploaded vault file on logoff', { rel, bytes: buf.length });
      } else if (result.skipped) {
        rvCloudLog('OneDrive', 'logoff skipped unchanged file', { rel, bytes: buf.length });
      }
      clearOneDrivePathDirty(singlesId, rel);
    } catch (err) {
      rvCloudWarn('OneDrive', 'logoff media upload failed', {
        rel,
        message: err?.message || String(err)
      });
    }
  }

  if (uploadMeta) clearOneDrivePathDirty(singlesId, VAULT_META_FILE);
  if (uploadDb) clearOneDrivePathDirty(singlesId, dbFileName);
  clearAllOneDriveDirty(singlesId);
  if (onProgress) await onProgress({ percent: 100, label: 'Done — Cloud save complete' });
}

export async function uploadOneDriveStagingRelativeFile(singlesId, mountPath, relativePath) {
  const rel = normalizeOneDriveRelativePath(relativePath);
  if (!rel) return;
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) return;
  const abs = path.join(vaultRootOnMount(mountPath), rel);
  if (!fs.existsSync(abs)) return;
  let buf = fs.readFileSync(abs);
  const meta = readVaultMeta(mountPath);
  if (isVaultDbRelativePath(rel) && !useEncryptedVaultFilenames(meta)) {
    if (!isSqliteVaultDbBuffer(buf)) {
      rvCloudWarn('OneDrive', 'skipped async upload — vault db is not SQLite', { rel, bytes: buf.length });
      return;
    }
    buf = Buffer.from(buf);
  }
  const mimeType = isVaultDbRelativePath(rel) ? 'application/x-sqlite3' : 'application/octet-stream';
  try {
    const transferStartedAt = Date.now();
    const result = await upsertOneDriveFileIfChanged(accessToken, folderId, rel, buf, mimeType);
    if (result.uploaded) {
      await trackVaultTransferBytes(singlesId, buf.length, transferStartedAt);
      rvCloudLog('OneDrive', 'uploaded vault file async', { rel, bytes: buf.length });
    }
    if (result.uploaded || result.skipped) {
      clearOneDrivePathDirty(singlesId, rel);
    }
    if (!useEncryptedVaultFilenames(meta) && !rel.endsWith('.enc')) {
      try {
        await deleteOneDriveItemAtPath(accessToken, folderId, `${rel}.enc`);
      } catch {
        // ignore if legacy .enc absent
      }
    }
  } catch (err) {
    rvCloudWarn('OneDrive', 'async upload failed — path stays dirty for logoff retry', {
      rel,
      message: err?.message || String(err)
    });
  }
}

export async function scheduleTrackedOneDriveUpload(singlesId, mountPath, relativePath) {
  const id = Number(singlesId);
  const rel = normalizeOneDriveRelativePath(relativePath);
  if (!Number.isFinite(id) || id < 1 || !rel) {
    return;
  }
  // Await Redis writes before pump — otherwise another node (or this pump) can drain an empty queue.
  await clusterRedisSet(onedriveMountKey(id), String(mountPath || ''));
  // Dedupe: vault.db / attachments can be dirtied many times; only one queued upload per path.
  const added = await clusterRedisSAdd(onedriveQueuedSetKey(id), rel);
  if (added > 0) {
    await clusterRedisRPush(onedriveQueueKey(id), rel);
  }
  void pumpOneDriveUploadQueue(id);
}

async function deleteVaultFilesInFolder(accessToken, folderId) {
  for (const fileName of [VAULT_META_FILE, ...listVaultDbFileNames(), 'test.txt']) {
    try {
      await deleteOneDriveItemAtPath(accessToken, folderId, fileName);
    } catch {
      // ignore per-file delete failures during format
    }
  }
  const children = await listOneDriveChildren(accessToken, folderId);
  for (const child of children) {
    if (!child?.id) continue;
    await deleteOneDriveItem(accessToken, child.id);
  }
}

async function deleteOneDriveVaultRootFolder(accessToken, folderId) {
  if (!folderId) return;
  try {
    const item = await getOneDriveItem(accessToken, folderId, 'id,name,folder');
    if (isOneDriveVaultRootFolderName(item?.name) && item?.folder) {
      await deleteOneDriveItem(accessToken, folderId);
      rvCloudLog('OneDrive', 'format deleted vault root folder', {
        folderId,
        name: item?.name
      });
      return;
    }
    rvCloudWarn('OneDrive', 'format folderId is not vault root — deleting children only', {
      folderId,
      name: item?.name || null
    });
    await deleteVaultFilesInFolder(accessToken, folderId);
  } catch (err) {
    rvCloudWarn('OneDrive', 'format delete folder failed — deleting children only', err, { folderId });
    await deleteVaultFilesInFolder(accessToken, folderId);
  }
}

async function purgeStrayVaultFoldersAtDriveRoot(accessToken) {
  const namesToPurge = new Set(listOneDriveVaultRootFolderNamesToPurge());
  const rootChildren = await listOneDriveChildren(accessToken, 'root');
  for (const child of rootChildren) {
    if (!namesToPurge.has(String(child?.name || '')) || !child?.folder || !child?.id) continue;
    await deleteOneDriveItem(accessToken, child.id);
    rvCloudLog('OneDrive', 'format deleted stray vault folder at drive root', {
      folderId: child.id,
      name: child.name
    });
  }
}

async function verifyOneDriveVaultAbsent(accessToken, folderId) {
  const metaFile = await getOneDriveItemAtPath(accessToken, folderId, VAULT_META_FILE, 'id');
  const dbFound = await findOneDriveVaultDbItem(accessToken, folderId);
  if (metaFile?.id || dbFound?.item?.id) {
    throw new Error('OneDrive vault files were not fully removed. Try Format again or disconnect and reconnect OneDrive.');
  }
}

/** Wipe vault on OneDrive: delete vault folder(s), recreate empty folder, persist new folderId. */
export async function wipeOneDriveVaultFolder(singlesId) {
  const conn = await loadOneDriveConnection(singlesId);
  if (!conn?.refreshToken) {
    throw new Error('Connect OneDrive first');
  }
  const tokens = await refreshOneDriveAccessToken(conn.refreshToken);
  const accessToken = String(tokens?.access_token || '').trim();
  if (!accessToken) {
    throw new Error('OneDrive session expired. Disconnect and connect OneDrive again.');
  }

  await deleteOneDriveVaultRootFolder(accessToken, conn.folderId);
  await purgeStrayVaultFoldersAtDriveRoot(accessToken);

  const newFolderId = await ensureVaultRootFolder(accessToken);
  await saveOneDriveConnection(singlesId, {
    refreshToken: conn.refreshToken,
    folderId: newFolderId,
    email: conn.email
  });
  await verifyOneDriveVaultAbsent(accessToken, newFolderId);
  rvCloudLog('OneDrive', 'format complete — fresh OneDrive vault folder', {
    singlesId,
    newFolderId,
    folderName: getOneDriveVaultFolderName()
  });
  return newFolderId;
}

export function cleanupOneDriveStaging(singlesId) {
  const mountPath = stagingMountPath(singlesId);
  try {
    fs.rmSync(mountPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function getOneDriveUnlockGuardStatus(singlesId) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    return { ok: false, error: 'OneDrive vault folder is not set up' };
  }
  const metaFile = await getOneDriveItemAtPath(accessToken, folderId, VAULT_META_FILE, 'id');
  if (!metaFile?.id) {
    return { ok: false, error: 'No vault found on OneDrive' };
  }
  const buf = await downloadOneDriveFileAtPath(accessToken, folderId, VAULT_META_FILE);
  let meta = null;
  try {
    meta = JSON.parse(buf.toString('utf8'));
  } catch {
    return { ok: false, error: 'Vault metadata on OneDrive is invalid' };
  }
  return getUnlockGuardStatusFromMeta(meta, 'No vault found on OneDrive');
}

export async function probeOneDriveVaultStatus(singlesId) {
  const conn = await loadOneDriveConnection(singlesId);
  if (!conn?.refreshToken) {
    return { connected: false, email: null, hasVault: false, folderId: null };
  }
  try {
    const { accessToken, folderId } = await getAccessTokenForSingles(singlesId, { conn });
    if (!folderId) {
      return { connected: true, email: conn.email, hasVault: false, folderId: null };
    }
    const metaFile = await getOneDriveItemAtPath(accessToken, folderId, VAULT_META_FILE, 'id');
    let meta = null;
    if (metaFile?.id) {
      const buf = await downloadOneDriveFileAtPath(accessToken, folderId, VAULT_META_FILE);
      try {
        let raw = buf.toString('utf8');
        if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
        meta = JSON.parse(raw);
      } catch {
        meta = null;
      }
    }
    const dbFound = await findOneDriveVaultDbItem(accessToken, folderId, meta);
    const hasVault = Boolean(metaFile?.id && dbFound?.item?.id);
    let legacyPinVault = false;
    let needsReformat = false;
    let metaSummary = null;
    if (meta?.vaultId) {
      try {
        const classified = classifyOneDriveVaultMeta(meta);
        legacyPinVault = Boolean(classified.legacyPinVault);
        metaSummary = {
          version: meta?.version ?? null,
          encryption: meta?.encryption ?? null
        };
        if (hasVault && isPhotoAlbumsIconEncryptionEnabled()) {
          const dbFileName = dbFound?.fileName || '';
          const hasEncryptedDbFile = dbFileName === VAULT_DB_FILE_ENCRYPTED;
          if (classified.legacyPinVault || !classified.valid) {
            needsReformat = true;
          } else if (classified.plaintext && !hasEncryptedDbFile) {
            // Plain meta + plain db — format before enabling icon encryption.
            needsReformat = true;
          } else {
            needsReformat = false;
          }
        }
      } catch {
        if (hasVault && isPhotoAlbumsIconEncryptionEnabled()) {
          needsReformat = true;
        }
      }
    } else if (metaFile?.id && hasVault && isPhotoAlbumsIconEncryptionEnabled()) {
      needsReformat = true;
    } else if (metaFile?.id && isPhotoAlbumsIconEncryptionEnabled() && !meta?.vaultId) {
      needsReformat = true;
    }
    const hasMetaFile = Boolean(metaFile?.id);
    const hasDbFile = Boolean(dbFound?.item?.id);
    let vaultFilesystemInvalid = false;
    if (folderId) {
      if (needsReformat || legacyPinVault) {
        vaultFilesystemInvalid = true;
      } else if (hasMetaFile && !hasDbFile) {
        vaultFilesystemInvalid = true;
      } else if (!hasMetaFile && hasDbFile) {
        vaultFilesystemInvalid = true;
      } else if (hasMetaFile && meta === null) {
        vaultFilesystemInvalid = true;
      }
    }
    return {
      connected: true,
      email: conn.email,
      hasVault,
      legacyPinVault,
      needsReformat,
      vaultFilesystemInvalid,
      metaSummary,
      folderId
    };
  } catch (err) {
    console.error('[probeOneDriveVaultStatus]', err?.message || err);
    return { connected: true, email: conn.email, hasVault: false, folderId: conn.folderId };
  }
}

export function oneDriveStagingHasVaultMeta(mountPath) {
  return fs.existsSync(vaultMetaPath(mountPath));
}

async function buildOneDriveFolderTree(accessToken, folderId, name) {
  const children = await listOneDriveChildren(accessToken, folderId);
  const nodes = [];
  for (const item of children) {
    const itemName = String(item?.name || '').trim();
    if (!itemName || !item?.id) continue;
    if (item.folder) {
      nodes.push(await buildOneDriveFolderTree(accessToken, item.id, itemName));
      continue;
    }
    if (item.file) {
      nodes.push({
        name: itemName,
        type: 'file',
        size: Number(item.size) || 0
      });
    }
  }
  nodes.sort((a, b) => {
    const aFolder = a.type === 'folder';
    const bFolder = b.type === 'folder';
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return { name, type: 'folder', children: nodes };
}

function sortOneDriveVaultTreeNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const aFolder = a.type === 'folder';
    const bFolder = b.type === 'folder';
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** Graph /children can miss root vault files — merge essentials fetched by path (matches OneDrive UI). */
async function ensureOneDriveVaultTreeEssentials(accessToken, folderId, tree) {
  const children = Array.isArray(tree?.children) ? [...tree.children] : [];
  const existing = new Set(children.map((node) => String(node?.name || '').toLowerCase()));

  const addFolderIfMissing = async (folderName) => {
    const key = folderName.toLowerCase();
    if (existing.has(key)) return;
    let item = await getOneDriveItemAtPath(accessToken, folderId, folderName, 'id,name,folder');
    if (!item?.id) {
      const listed = await listOneDriveChildren(accessToken, folderId);
      item = listed.find((entry) => String(entry?.name || '') === folderName && entry?.folder) || null;
    }
    if (item?.id && item?.folder) {
      children.push(await buildOneDriveFolderTree(accessToken, item.id, folderName));
      existing.add(key);
    }
  };

  await addFolderIfMissing(VAULT_PHOTOS_DIR);
  await addFolderIfMissing(VAULT_FILES_DIR);

  for (const rel of oneDriveVaultMetaRelativePaths()) {
    const baseName = path.basename(rel);
    const key = baseName.toLowerCase();
    if (existing.has(key)) break;
    const item = await getOneDriveItemAtPath(accessToken, folderId, rel, 'id,name,file,size');
    if (item?.id && !item?.folder) {
      children.push({
        name: baseName,
        type: 'file',
        size: Number(item.size) || 0
      });
      existing.add(key);
      break;
    }
  }

  const dbFound = await findOneDriveVaultDbItem(accessToken, folderId);
  if (dbFound?.fileName) {
    const key = dbFound.fileName.toLowerCase();
    if (!existing.has(key)) {
      children.push({
        name: dbFound.fileName,
        type: 'file',
        size: Number(dbFound.item?.size) || 0
      });
      existing.add(key);
    }
  }

  return { ...tree, children: sortOneDriveVaultTreeNodes(children) };
}

/** Read-only recursive listing of the user's OneDrive vault folder (cluster-safe: DB token + Graph API). */
export async function listOneDriveVaultTree(singlesId) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up yet');
  }
  const folderName = getOneDriveVaultFolderName();
  const tree = await ensureOneDriveVaultTreeEssentials(
    accessToken,
    folderId,
    await buildOneDriveFolderTree(accessToken, folderId, folderName)
  );
  return { folderName, tree };
}

export async function writeOneDriveTestFile(singlesId) {
  const provider = 'OneDrive';
  rvCloudLog(provider, 'test-write start', { singlesId });
  let accessToken;
  let folderId;
  try {
    ({ accessToken, folderId } = await getAccessTokenForSingles(singlesId));
  } catch (err) {
    rvCloudError(provider, 'test-write connection/token failed', err, { singlesId });
    throw err;
  }
  rvCloudDebug(provider, 'test-write using folderId', { folderId });
  const buffer = Buffer.from(TEST_WRITE_FILE_BODY, 'utf8');
  try {
    await upsertOneDriveFileAtPath(accessToken, folderId, TEST_WRITE_FILE_NAME, buffer, 'text/plain');
  } catch (err) {
    rvCloudError(provider, 'test-write upload failed', err, { folderId });
    throw err;
  }
  rvCloudLog(provider, 'test-write success', { singlesId, folderId, fileName: TEST_WRITE_FILE_NAME });
  return { success: true, fileName: TEST_WRITE_FILE_NAME };
}

export { stagingMountPath };
