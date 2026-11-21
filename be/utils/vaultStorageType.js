/**
 * Canonical vault storage ids.
 * Cloud workspace was historically labeled `tutadrive` (UI) / `onedrive` (session slot).
 * Both map to `tutaCloud`. Microsoft Graph OAuth env/columns may still say ONEDRIVE_*.
 */
export const VAULT_CLOUD_STORAGE_TYPE = 'tutaCloud';
export const VAULT_USB_STORAGE_TYPE = 'usb';

const CLOUD_ALIASES = new Set([
  'tutacloud',
  'tutadrive',
  'onedrive',
  'cloud'
]);

/**
 * @param {unknown} raw
 * @param {'usb'|'tutaCloud'} [fallback='usb']
 * @returns {'usb'|'tutaCloud'}
 */
export function normalizeVaultStorageType(raw, fallback = VAULT_USB_STORAGE_TYPE) {
  const value = String(raw ?? fallback).trim().toLowerCase();
  if (CLOUD_ALIASES.has(value)) return VAULT_CLOUD_STORAGE_TYPE;
  if (value === 'usb') return VAULT_USB_STORAGE_TYPE;
  // Accept already-canonical camelCase if caller did not lower it.
  if (String(raw ?? '').trim() === VAULT_CLOUD_STORAGE_TYPE) return VAULT_CLOUD_STORAGE_TYPE;
  return VAULT_USB_STORAGE_TYPE;
}

export function isVaultCloudStorageType(raw) {
  return normalizeVaultStorageType(raw) === VAULT_CLOUD_STORAGE_TYPE;
}
