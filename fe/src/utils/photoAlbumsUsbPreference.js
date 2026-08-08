const PHOTO_ALBUMS_LAST_USB_LS_KEY = 'photoAlbumsLastUsbLocation_v1';
const PHOTO_ALBUMS_LAST_BACKUP_USB_LS_KEY = 'photoAlbumsLastBackupUsbLocation_v1';

export function readPhotoAlbumsLastUsbLocation() {
  try {
    const raw = localStorage.getItem(PHOTO_ALBUMS_LAST_USB_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const mountPath = String(parsed?.mountPath ?? '').trim();
    if (!mountPath) return null;
    return {
      mountPath,
      label: String(parsed?.label ?? mountPath),
      hasVault: Boolean(parsed?.hasVault)
    };
  } catch {
    return null;
  }
}

export function writePhotoAlbumsLastUsbLocation(location) {
  const mountPath = String(location?.mountPath ?? '').trim();
  if (!mountPath) return;
  try {
    localStorage.setItem(
      PHOTO_ALBUMS_LAST_USB_LS_KEY,
      JSON.stringify({
        mountPath,
        label: String(location?.label ?? mountPath),
        hasVault: Boolean(location?.hasVault)
      })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function readPhotoAlbumsLastBackupUsbLocation() {
  try {
    const raw = localStorage.getItem(PHOTO_ALBUMS_LAST_BACKUP_USB_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const mountPath = String(parsed?.mountPath ?? '').trim();
    if (!mountPath) return null;
    return {
      mountPath,
      label: String(parsed?.label ?? mountPath),
      hasVault: Boolean(parsed?.hasVault)
    };
  } catch {
    return null;
  }
}

export function writePhotoAlbumsLastBackupUsbLocation(location) {
  const mountPath = String(location?.mountPath ?? '').trim();
  if (!mountPath) return;
  try {
    localStorage.setItem(
      PHOTO_ALBUMS_LAST_BACKUP_USB_LS_KEY,
      JSON.stringify({
        mountPath,
        label: String(location?.label ?? mountPath),
        hasVault: Boolean(location?.hasVault)
      })
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearPhotoAlbumsLastBackupUsbLocation() {
  try {
    localStorage.removeItem(PHOTO_ALBUMS_LAST_BACKUP_USB_LS_KEY);
  } catch {
    // ignore
  }
}

export function clearPhotoAlbumsLastUsbLocation() {
  try {
    localStorage.removeItem(PHOTO_ALBUMS_LAST_USB_LS_KEY);
  } catch {
    // ignore
  }
}
