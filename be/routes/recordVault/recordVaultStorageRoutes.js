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
import { isIncludeUsbDmgExeEnabled } from '../../utils/includeUsbDmgExeConfig.js';

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
  const includeUsbDmgExe = isIncludeUsbDmgExeEnabled();
  const usbBridgeInstallers = includeUsbDmgExe ? getRecordVaultBridgeInstallerUrls() : { mac: null, win: null };
  const leftSide = getLeftSideMode();
  const tutaDrive = isLeftSideTutaDrive();
  let oneDrive;
  if (leftSide === 'None') {
    oneDrive = { visible: false, oauthConfigured: false, enabled: false, tutaDrive: false };
  } else if (tutaDrive) {
    oneDrive = { visible: true, oauthConfigured: true, enabled: true, tutaDrive: true };
  } else {
    oneDrive = buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured());
  }

  return res.json({
    leftSide,
    tutaDrive,
    rightSide: isVaultLocalUsbOffered() ? 'USB' : 'None',
    oneDrive,
    localUsb: buildVaultStorageChoice(isVaultLocalUsbOffered(), true),
    backupUsbEnabled: isVaultBackupUsbEnabled(),
    iconEncryptionRequired: isRecordVaultIconEncryptionEnabled(),
    encryptPhotoAndDb: isVaultPhotoAndDbEncryptionEnabled(),
    iconRetryDelaySeconds: getVaultIconRetryDelaySeconds(),
    cacheOneDriveIcon,
    cacheUsbIcon,
    videoTutorialTutanotes,
    includeUsbDmgExe,
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
