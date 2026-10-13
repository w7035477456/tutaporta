/**
 * Env toggles for TutaPhotoAlbums storage choices (~/.ssh/be/.env).
 *
 * DISABLE_USBDRIVE retires the USB bridge.
 * LEFT_SIDE=TutaDrive uses local LARGE_CHEAP_STORAGE_FOLDER.
 */

import { isDisableUsbDriveEnabled } from './vaultStorageDisableConfig.js';
import { getLeftSideMode, getRightSideMode } from './tutaDriveMemberPaths.js';

/** Left-panel cloud workspace (TutaDrive when LEFT_SIDE=TutaDrive). */
export function isVaultTutaCloudOffered() {
  return getLeftSideMode() !== 'None';
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

/** Microsoft Graph sync removed — vault cloud workspace is local TutaDrive only. */
export function isVaultCloudSyncEnabled() {
  return false;
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
