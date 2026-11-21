/** Cloud workspace pane id (UI + drag-drop + BE session slot). */
export const VAULT_CLOUD_STORAGE_TYPE = 'tutaCloud';
export const VAULT_USB_STORAGE_TYPE = 'usb';

const CLOUD_ALIASES = new Set([
  'tutacloud',
  'tutadrive',
  'onedrive',
  'cloud'
]);

export function normalizeVaultPaneStorageType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === VAULT_USB_STORAGE_TYPE) return VAULT_USB_STORAGE_TYPE;
  if (CLOUD_ALIASES.has(s) || String(raw || '').trim() === VAULT_CLOUD_STORAGE_TYPE) {
    return VAULT_CLOUD_STORAGE_TYPE;
  }
  return VAULT_USB_STORAGE_TYPE;
}

export function isVaultCloudPaneStorageType(raw) {
  return normalizeVaultPaneStorageType(raw) === VAULT_CLOUD_STORAGE_TYPE;
}

/** BE session slot + `X-Record-Vault-Storage` for TutaCloud workspace (same as pane id). */
export function vaultCloudBackendStorageSlot() {
  return VAULT_CLOUD_STORAGE_TYPE;
}
