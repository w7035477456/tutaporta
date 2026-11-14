import { buildVaultStorageChoice, isVaultTutaCloudOffered } from '../../utils/recordVaultStorageFlags.js';
import { getLeftSideMode, isLeftSideTutaDrive } from '../../utils/tutaDriveMemberPaths.js';
import { isVaultE2eYellow } from '../../utils/vaultE2eYellowConfig.js';
import { isRecordVaultIconEncryptionEnabled } from '../../utils/recordVaultIconEncryption.js';
import { isVaultPhotoAndDbEncryptionEnabled } from '../../utils/recordVaultUsb/vaultCrypto.js';
import { getVaultIconRetryDelaySeconds } from '../../utils/recordVaultUsb/unlockGuard.js';
import { logoffVaultUsb } from '../../utils/recordVaultUsb/vaultSession.js';
import { clearRecordVaultCacheIcon, readRecordVaultCacheIcon } from '../../utils/recordVaultCacheIcon.js';
import {
  clearVaultLogoffProgress,
  getVaultLogoffProgress,
  setVaultLogoffProgress
} from '../../utils/recordVaultVaultLogoffProgress.js';
import { loadGlobalVideoTutorialTutanotes } from '../../utils/globalVideoTutorialTutanotes.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

/** GET /api/recordVault/storage/config — which vault backends to show in Step 2 UI */
export async function getRecordVaultStorageConfig(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  // Legacy DB/Redis slot name `onedrive` — Tuta cloud workspace session icon.
  let cacheTutaCloudIcon = null;
  try {
    cacheTutaCloudIcon = await readRecordVaultCacheIcon(singlesId, 'onedrive');
  } catch {
    cacheTutaCloudIcon = null;
  }

  const videoTutorialTutanotes = await loadGlobalVideoTutorialTutanotes();
  const leftSide = getLeftSideMode();
  const tutaDrive = isLeftSideTutaDrive();
  const tutaCloud = {
    ...buildVaultStorageChoice(isVaultTutaCloudOffered(), true),
    tutaDrive
  };

  return res.json({
    leftSide,
    tutaDrive,
    rightSide: 'None',
    tutaCloud,
    localUsb: buildVaultStorageChoice(false, true),
    backupUsbEnabled: false,
    iconEncryptionRequired: isRecordVaultIconEncryptionEnabled(),
    encryptPhotoAndDb: isVaultPhotoAndDbEncryptionEnabled(),
    iconRetryDelaySeconds: getVaultIconRetryDelaySeconds(),
    cacheTutaCloudIcon,
    cacheUsbIcon: '',
    videoTutorialTutanotes,
    e2eYellow: isVaultE2eYellow()
  });
}

/** GET /api/recordVault/storage/logoff-progress */
export async function getRecordVaultStorageLogoffProgress(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  try {
    const progress = await getVaultLogoffProgress(singlesId);
    return res.json(progress);
  } catch (err) {
    console.error('[getRecordVaultStorageLogoffProgress]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Unable to read logoff progress' });
  }
}

/** POST /api/recordVault/storage/logoff — single round-trip vault storage logoff */
export async function logoffRecordVaultStorage(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    await clearVaultLogoffProgress(singlesId);
    const result = await logoffVaultUsb(singlesId, null, {
      onProgress: (progress) => setVaultLogoffProgress(singlesId, progress)
    });
    await clearRecordVaultCacheIcon(singlesId);
    return res.json({ ...result, cacheTutaCloudIcon: '', cacheUsbIcon: '' });
  } catch (err) {
    console.error('[logoffRecordVaultStorage]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  }
}
