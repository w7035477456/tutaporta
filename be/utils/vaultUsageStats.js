import { getVaultSession, vaultUsbStatus } from './recordVaultUsb/vaultSession.js';
import { computeVaultFolderSizeBytes } from './recordVaultUsb/vaultFolderSize.js';
import { getVaultTransferStats } from './vaultTransferTracking.js';
import { getVaultSessionFileCounts } from './vaultSessionFileCounts.js';
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
  const tutaDriveSession = Boolean(session?.tutaDrive) || isLeftSideTutaDrive();

  const result = {
    storageType: activeStorageType,
    transfer,
    sessionFileCounts: {
      usbTxRx: Number(sessionFileCounts.usbTxRx) || 0,
      uiTxRx: Number(sessionFileCounts.uiTxRx) || 0
    },
    subscriptionTier: 'FREE',
    vaultFolderMb: 0,
    tutaDrive: false,
    tutaDriveStorage: null
  };

  if (tutaDriveSession && activeStorageType === 'onedrive') {
    const disk = await loadTutaDriveMemberNotesPhotosSizeForSingles(singlesId);
    applyTutaDriveDiskTotal(result, disk);
    return result;
  }

  if (activeStorageType === 'onedrive' && session?.unlocked && session.mountPath) {
    result.vaultFolderMb = vaultFolderMbFromBytes(computeVaultFolderSizeBytes(session.mountPath));
  }

  return result;
}
