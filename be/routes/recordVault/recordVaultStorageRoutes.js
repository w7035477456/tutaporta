import {
  buildVaultStorageChoice,
  isVaultBackupUsbEnabled,
  isVaultLocalUsbOffered,
  isVaultOneDriveOffered
} from '../../utils/recordVaultStorageFlags.js';
import { getLeftSideMode, isLeftSideTutaDrive } from '../../utils/tutaDriveMemberPaths.js';
import { isVaultE2eYellow } from '../../utils/vaultE2eYellowConfig.js';
import { isOneDriveVaultOAuthConfigured } from '../../utils/recordVaultOneDrive/oneDriveApi.js';
import { isRecordVaultIconEncryptionEnabled } from '../../utils/recordVaultIconEncryption.js';
import { isVaultPhotoAndDbEncryptionEnabled } from '../../utils/recordVaultUsb/vaultCrypto.js';
import { getVaultIconRetryDelaySeconds } from '../../utils/recordVaultUsb/unlockGuard.js';
import { logoffVaultUsb } from '../../utils/recordVaultUsb/vaultSession.js';
import { clearRecordVaultCacheIcon, readRecordVaultCacheIcon } from '../../utils/recordVaultCacheIcon.js';
import { loadGlobalVideoTutorialTutanotes } from '../../utils/globalVideoTutorialTutanotes.js';
import { getRecordVaultBridgeInstallerUrls } from './recordVaultBridgeInstaller.js';

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
  let cacheOneDriveIcon = null;
  let cacheUsbIcon = null;
  try {
    cacheOneDriveIcon = await readRecordVaultCacheIcon(singlesId, 'onedrive');
  } catch {
    cacheOneDriveIcon = null;
  }
  try {
    cacheUsbIcon = await readRecordVaultCacheIcon(singlesId, 'usb');
  } catch {
    cacheUsbIcon = null;
  }

  const videoTutorialTutanotes = await loadGlobalVideoTutorialTutanotes();
  const usbBridgeInstallers = getRecordVaultBridgeInstallerUrls();
  const leftSide = getLeftSideMode();
  const tutaDrive = isLeftSideTutaDrive();
  const oneDrive = tutaDrive
    ? { visible: true, oauthConfigured: true, enabled: true, tutaDrive: true }
    : buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured());

  return res.json({
    leftSide,
    tutaDrive,
    oneDrive,
    localUsb: buildVaultStorageChoice(isVaultLocalUsbOffered(), true),
    backupUsbEnabled: isVaultBackupUsbEnabled(),
    iconEncryptionRequired: isRecordVaultIconEncryptionEnabled(),
    encryptPhotoAndDb: isVaultPhotoAndDbEncryptionEnabled(),
    iconRetryDelaySeconds: getVaultIconRetryDelaySeconds(),
    cacheOneDriveIcon,
    cacheUsbIcon,
    videoTutorialTutanotes,
    usbBridgeInstallers,
    e2eYellow: isVaultE2eYellow()
  });
}

/** POST /api/recordVault/storage/logoff — single round-trip vault storage logoff */
export async function logoffRecordVaultStorage(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await logoffVaultUsb(singlesId);
    await clearRecordVaultCacheIcon(singlesId);
    return res.json({ ...result, cacheOneDriveIcon: '', cacheUsbIcon: '' });
  } catch (err) {
    console.error('[logoffRecordVaultStorage]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  }
}
