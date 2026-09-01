/**
 * Env toggles for TutaPhotoAlbums storage choices (~/.ssh/be/.env).
 *
 * DISABLE_ONEDRIVE / DISABLE_USBDRIVE retire Microsoft OneDrive / USB bridge.
 * LEFT_SIDE=TutaDrive uses local LARGE_CHEAP_STORAGE_FOLDER (not Microsoft Graph).
 */

import {
  isDisableOnedriveEnabled,
  isDisableUsbDriveEnabled
} from './vaultStorageDisableConfig.js';
import { getLeftSideMode, getRightSideMode } from './tutaDriveMemberPaths.js';

export function isVaultOneDriveOffered() {
  if (isDisableOnedriveEnabled()) return false;
  return getLeftSideMode() === 'OneDrive';
}

export function isVaultLocalUsbOffered() {
  if (isDisableUsbDriveEnabled()) return false;
  const right = getRightSideMode();
  if (right === 'None') return false;
  if (right === 'USB') return true;
  const legacy = String(process.env.NOTES_LOCAL_USB ?? 'true').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(legacy);
}

/** Optional backup USB slot — retired when USB bridge disabled. */
export function isVaultBackupUsbEnabled() {
  return isVaultLocalUsbOffered();
}

/**
 * Microsoft Graph sync for the vault (upload on write/logoff, lazy download).
 * Off when OneDrive disabled or LEFT_SIDE=TutaDrive.
 */
export function isVaultCloudSyncEnabled() {
  if (isDisableOnedriveEnabled()) return false;
  return getLeftSideMode() === 'OneDrive';
}

export function buildVaultStorageChoice(visible, oauthConfigured = true) {
  const offered = Boolean(visible);
  const oauthReady = Boolean(oauthConfigured);
  return {
    visible: offered,
    oauthConfigured: oauthReady,
    enabled: offered && oauthReady
  };
}
