/**
 * Env toggles for TutaPhotoAlbums storage choices (~/.ssh/be/.env).
 *
 * Microsoft OneDrive and the USB bridge are retired: TutaPhotoAlbums stores
 * everything under LARGE_CHEAP_STORAGE_FOLDER (TutaDrive). The TutaDrive vault
 * borrows the 'onedrive' session slot, so anything that talks to Microsoft
 * Graph must stay off or it will upload/overwrite the local vault.
 */

export function isVaultOneDriveOffered() {
  return false;
}

/** Local USB bridge /myPhotoAlbums right panel — retired. */
export function isVaultLocalUsbOffered() {
  return false;
}

/** Optional backup USB slot — retired. */
export function isVaultBackupUsbEnabled() {
  return false;
}

/**
 * Microsoft Graph sync for the vault (upload on write/logoff, lazy download).
 * Off: the TutaDrive folder is the only copy.
 */
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
