/** Env toggles for TutaPhotoAlbums storage choices (~/.ssh/be/.env). */

import { isRightSideUsb } from './tutaDriveMemberPaths.js';

function parseEnvBool(raw, defaultValue = true) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

export function isVaultOneDriveOffered() {
  return parseEnvBool(process.env.PHOTOALBUMS_ONE_DRIVE, true);
}

/**
 * Local USB bridge /myPhotoAlbums right panel.
 * Prefer RIGHT_SIDE=USB | None when set; else PHOTOALBUMS_LOCAL_USB (default false).
 */
export function isVaultLocalUsbOffered() {
  const rightSideUsb = isRightSideUsb();
  if (rightSideUsb != null) return rightSideUsb;
  return parseEnvBool(process.env.PHOTOALBUMS_LOCAL_USB, false);
}

/** Optional backup USB slot — off when PHOTOALBUMS_BACKUP_USB_DISABLE=true. */
export function isVaultBackupUsbEnabled() {
  if (parseEnvBool(process.env.PHOTOALBUMS_BACKUP_USB_DISABLE, false)) return false;
  return true;
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
