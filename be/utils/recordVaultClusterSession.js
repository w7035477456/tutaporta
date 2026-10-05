import fs from 'fs';
import {
  clusterRedisDel,
  clusterRedisGetJson,
  clusterRedisSetJson
} from './clusterRedisState.js';
import {
  VAULT_PRODUCT_RECORD_VAULT,
  clearVaultClusterUnlockState,
  getVaultClusterUnlockState,
  isVaultClusterCoherenceEnabled,
  registerVaultClusterUnlockState
} from './vaultClusterCoherence.js';

const UNLOCK_PREFIX = 'v1:record_vault:unlock:';
/** Standalone bridge only (website uses Postgres vault_cluster_state). */
const UNLOCK_TTL_SEC = 24 * 60 * 60;

export function vaultClusterUnlockKey(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  const type = String(storageType || 'usb').trim().toLowerCase() === 'onedrive' ? 'onedrive' : 'usb';
  return `${UNLOCK_PREFIX}${id}:${type}`;
}

/** @returns {Promise<{ dbVersion: number, unlockGeneration: number } | null>} */
export async function registerVaultClusterUnlock({
  singlesId,
  storageType,
  mountPath,
  backupMountPath = null,
  driveFolderId = null
}) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return null;
  const mount = String(mountPath || '').trim();
  if (!mount) return null;
  if (isVaultClusterCoherenceEnabled()) {
    return registerVaultClusterUnlockState(VAULT_PRODUCT_RECORD_VAULT, {
      singlesId: id,
      storageType,
      mountPath: mount,
      backupMountPath,
      driveFolderId
    });
  }
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
  return null;
}

export async function clearVaultClusterUnlock(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return;
  if (isVaultClusterCoherenceEnabled()) {
    await clearVaultClusterUnlockState(VAULT_PRODUCT_RECORD_VAULT, id, storageType || null);
    return;
  }
  if (!storageType) {
    await clusterRedisDel(vaultClusterUnlockKey(id, 'usb'), vaultClusterUnlockKey(id, 'onedrive'));
    return;
  }
  await clusterRedisDel(vaultClusterUnlockKey(id, storageType));
}

export async function getVaultClusterUnlock(singlesId, storageType) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return null;
  if (isVaultClusterCoherenceEnabled()) {
    return getVaultClusterUnlockState(VAULT_PRODUCT_RECORD_VAULT, id, storageType);
  }
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
