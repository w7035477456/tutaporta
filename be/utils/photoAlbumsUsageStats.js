import { getVaultSession, vaultUsbStatus } from './photoAlbumsUsb/vaultSession.js';
import { computeVaultFolderSizeBytes } from './photoAlbumsUsb/vaultFolderSize.js';
import { getVaultTransferStats } from './photoAlbumsTransferTracking.js';
import { getVaultSessionFileCounts } from './photoAlbumsSessionFileCounts.js';
import { loadOneDriveConnection } from './photoAlbumsOneDrive/oneDriveTokenStore.js';
import {
  computeOneDriveFolderSizeBytes,
  fetchOneDriveStorageQuota
} from './photoAlbumsOneDrive/oneDriveApi.js';
import { getAccessTokenForSingles } from './photoAlbumsOneDrive/oneDriveVaultSync.js';
import {
  isLeftSideTutaDrive,
  loadTutaDriveMemberNotesPhotosSizeForSingles
} from './tutaDriveMemberPaths.js';

function vaultFolderMbFromBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.ceil(value / (1024 * 1024)));
}

function applyTutaDriveDiskTotal(result, disk) {
  if (!disk) return result;
  result.tutaDrive = true;
  result.tutaDriveStorage = {
    memberFolder: disk.memberFolder,
    notesBytes: disk.notesBytes,
    photosBytes: disk.photosBytes,
    totalBytes: disk.totalBytes,
    usedGb: disk.usedGb
  };
  result.vaultFolderMb = disk.totalMb;
  return result;
}

export async function buildPhotoAlbumsUsageStats(singlesId, storageType = null) {
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
  const tutaDriveSession = Boolean(session?.tutaDrive) || isLeftSideTutaDrive();

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
    onedriveStorage: null,
    tutaDrive: false,
    tutaDriveStorage: null
  };

  if (tutaDriveSession && activeStorageType === 'onedrive') {
    const disk = await loadTutaDriveMemberNotesPhotosSizeForSingles(singlesId);
    applyTutaDriveDiskTotal(result, disk);
    return result;
  }

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
