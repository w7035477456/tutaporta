import {
  buildVaultStorageChoice,
  isVaultBackupUsbEnabled,
  isVaultLocalUsbOffered,
  isVaultOneDriveOffered
} from '../../utils/photoAlbumsStorageFlags.js';
import { isVaultE2eYellow } from '../../utils/photoAlbumsE2eYellowConfig.js';
import { isOneDriveVaultOAuthConfigured } from '../../utils/photoAlbumsOneDrive/oneDriveApi.js';
import { isPhotoAlbumsIconEncryptionEnabled } from '../../utils/photoAlbumsIconEncryption.js';
import { isVaultPhotoAndDbEncryptionEnabled } from '../../utils/photoAlbumsUsb/vaultCrypto.js';
import { getVaultIconRetryDelaySeconds } from '../../utils/photoAlbumsUsb/unlockGuard.js';
import { logoffVaultUsb } from '../../utils/photoAlbumsUsb/vaultSession.js';
import { clearPhotoAlbumsCacheIcon, readPhotoAlbumsCacheIcon } from '../../utils/photoAlbumsCacheIcon.js';
import { loadGlobalVideoTutorialPhotoAlbums } from '../../utils/globalVideoTutorialPhotoAlbums.js';
import { getPhotoAlbumsBridgeInstallerUrls } from './photoAlbumsBridgeInstaller.js';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

/** GET /api/photoAlbums/storage/config — which vault backends to show in Step 2 UI */
export async function getPhotoAlbumsStorageConfig(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;
  let cacheOneDriveIcon = null;
  let cacheUsbIcon = null;
  try {
    cacheOneDriveIcon = await readPhotoAlbumsCacheIcon(singlesId, 'onedrive');
  } catch {
    cacheOneDriveIcon = null;
  }
  try {
    cacheUsbIcon = await readPhotoAlbumsCacheIcon(singlesId, 'usb');
  } catch {
    cacheUsbIcon = null;
  }

  const videoTutorialTutaphotoalbums = await loadGlobalVideoTutorialPhotoAlbums();
  const usbBridgeInstallers = getPhotoAlbumsBridgeInstallerUrls();

  return res.json({
    oneDrive: buildVaultStorageChoice(isVaultOneDriveOffered(), isOneDriveVaultOAuthConfigured()),
    localUsb: buildVaultStorageChoice(isVaultLocalUsbOffered(), true),
    backupUsbEnabled: isVaultBackupUsbEnabled(),
    iconEncryptionRequired: isPhotoAlbumsIconEncryptionEnabled(),
    encryptPhotoAndDb: isVaultPhotoAndDbEncryptionEnabled(),
    iconRetryDelaySeconds: getVaultIconRetryDelaySeconds(),
    cacheOneDriveIcon,
    cacheUsbIcon,
    videoTutorialTutaphotoalbums,
    usbBridgeInstallers,
    e2eYellow: isVaultE2eYellow()
  });
}

/** POST /api/photoAlbums/storage/logoff — single round-trip vault storage logoff */
export async function logoffPhotoAlbumsStorage(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await logoffVaultUsb(singlesId);
    await clearPhotoAlbumsCacheIcon(singlesId);
    return res.json({ ...result, cacheOneDriveIcon: '', cacheUsbIcon: '' });
  } catch (err) {
    console.error('[logoffPhotoAlbumsStorage]', err?.message || err);
    return res.status(400).json({ error: err?.message || 'Logoff failed' });
  }
}
