import { getVaultSession, vaultUsbStatus } from './recordVaultUsb/vaultSession.js';
import { computeVaultFolderSizeBytes } from './recordVaultUsb/vaultFolderSize.js';
import { getVaultTransferStats } from './vaultTransferTracking.js';
import { getVaultSessionFileCounts } from './vaultSessionFileCounts.js';
import { loadOneDriveConnection } from './recordVaultOneDrive/oneDriveTokenStore.js';
import {
  computeOneDriveFolderSizeBytes,
  fetchOneDriveStorageQuota
} from './recordVaultOneDrive/oneDriveApi.js';
import { getAccessTokenForSingles } from './recordVaultOneDrive/oneDriveVaultSync.js';

function vaultFolderMbFromBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.ceil(value / (1024 * 1024)));
}

export async function buildRecordVaultUsageStats(singlesId, storageType = null) {
  let session = storageType ? getVaultSession(singlesId, storageType) : getVaultSession(singlesId);
  if (!session) {
    const status = storageType
      ? await vaultUsbStatus(singlesId, storageType)
      : await vaultUsbStatus(singlesId);
    if (status?.unlocked && status.storageType) {
      session = getVaultSession(singlesId, status.storageType);
    }
  }
  const activeStorageType = session?.storageType || storageType || null;
  const transfer = await getVaultTransferStats(singlesId);
  const sessionFileCounts = await getVaultSessionFileCounts(singlesId);

  const result = {
    storageType: activeStorageType,
    transfer,
    sessionFileCounts: {
      usbTxRx: Number(sessionFileCounts.usbTxRx) || 0,
      uiTxRx: Number(sessionFileCounts.uiTxRx) || 0
    },
    subscriptionTier: 'FREE',
    onedriveEmail: null,
    vaultFolderMb: 0,
    onedriveStorage: null
  };

  if (activeStorageType !== 'onedrive') {
    return result;
  }

  const conn = await loadOneDriveConnection(singlesId);
  result.onedriveEmail = String(conn?.email || '').trim() || null;

  try {
    const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
    if (!result.onedriveEmail) {
      result.onedriveEmail = String(conn?.email || '').trim() || null;
    }

    const quota = await fetchOneDriveStorageQuota(accessToken);
    result.onedriveStorage = {
      usedGb: quota.usedGb,
      totalGb: quota.totalGb,
      leftPct: quota.storageLeftPct
    };

    if (session?.unlocked && session.mountPath) {
      result.vaultFolderMb = vaultFolderMbFromBytes(computeVaultFolderSizeBytes(session.mountPath));
    } else if (folderId) {
      const folderBytes = await computeOneDriveFolderSizeBytes(accessToken, folderId);
      result.vaultFolderMb = vaultFolderMbFromBytes(folderBytes);
    }
  } catch (err) {
    result.onedriveError = err?.message || 'Unable to load OneDrive usage';
  }

  return result;
}
