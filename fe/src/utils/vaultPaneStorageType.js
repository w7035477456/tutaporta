/** Cloud workspace pane id (UI + drag-drop). Backend session slot remains `onedrive`. */
export const VAULT_CLOUD_STORAGE_TYPE = 'tutadrive';
export const VAULT_USB_STORAGE_TYPE = 'usb';

export function normalizeVaultPaneStorageType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === VAULT_USB_STORAGE_TYPE) return VAULT_USB_STORAGE_TYPE;
  if (
    s === VAULT_CLOUD_STORAGE_TYPE ||
    s === 'cloud' ||
    s === 'tutacloud' ||
    s === 'onedrive'
  ) {
    return VAULT_CLOUD_STORAGE_TYPE;
  }
  return VAULT_USB_STORAGE_TYPE;
}

export function isVaultCloudPaneStorageType(raw) {
  return normalizeVaultPaneStorageType(raw) === VAULT_CLOUD_STORAGE_TYPE;
}

/** Legacy BE session slot + `X-Record-Vault-Storage` for TutaCloud workspace. */
export function vaultCloudBackendStorageSlot() {
  return 'onedrive';
}
