import fs from 'fs';
import {
  clusterRedisDel,
  clusterRedisGetJson,
  clusterRedisSetJson
} from './clusterRedisState.js';

const UNLOCK_PREFIX = 'v1:photo_albums:unlock:';
/** Match typical idle session; unlock re-established on next API call if expired. */
const UNLOCK_TTL_SEC = 24 * 60 * 60;

export function vaultClusterUnlockKey(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  const type = String(storageType || 'usb').trim().toLowerCase() === 'onedrive' ? 'onedrive' : 'usb';
  return `${UNLOCK_PREFIX}${id}:${type}`;
}

export async function registerVaultClusterUnlock({
  singlesId,
  storageType,
  mountPath,
  backupMountPath = null,
  driveFolderId = null
}) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return;
  const mount = String(mountPath || '').trim();
  if (!mount) return;
  await clusterRedisSetJson(
    vaultClusterUnlockKey(id, storageType),
    {
      singlesId: id,
      storageType: String(storageType || 'usb').trim().toLowerCase() === 'onedrive' ? 'onedrive' : 'usb',
      mountPath: mount,
      backupMountPath: backupMountPath ? String(backupMountPath).trim() : null,
      driveFolderId: driveFolderId ? String(driveFolderId).trim() : null,
      unlockedAt: Date.now()
    },
    UNLOCK_TTL_SEC
  );
}

export async function clearVaultClusterUnlock(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return;
  if (!storageType) {
    await clusterRedisDel(vaultClusterUnlockKey(id, 'usb'), vaultClusterUnlockKey(id, 'onedrive'));
    return;
  }
  await clusterRedisDel(vaultClusterUnlockKey(id, storageType));
}

export async function getVaultClusterUnlock(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return null;
  return clusterRedisGetJson(vaultClusterUnlockKey(id, storageType));
}

export function isVaultMountPathPresent(mountPath) {
  const mount = String(mountPath || '').trim();
  if (!mount) return false;
  try {
    return fs.existsSync(mount);
  } catch {
    return false;
  }
}
