const RECORD_VAULT_LAST_USB_LS_KEY = 'recordVaultLastUsbLocation_v1';
const RECORD_VAULT_LAST_BACKUP_USB_LS_KEY = 'recordVaultLastBackupUsbLocation_v1';

export function readRecordVaultLastUsbLocation() {
  try {
    const raw = localStorage.getItem(RECORD_VAULT_LAST_USB_LS_KEY);
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

export function writeRecordVaultLastUsbLocation(location) {
  const mountPath = String(location?.mountPath ?? '').trim();
  if (!mountPath) return;
  try {
    localStorage.setItem(
      RECORD_VAULT_LAST_USB_LS_KEY,
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

export function readRecordVaultLastBackupUsbLocation() {
  try {
    const raw = localStorage.getItem(RECORD_VAULT_LAST_BACKUP_USB_LS_KEY);
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

export function writeRecordVaultLastBackupUsbLocation(location) {
  const mountPath = String(location?.mountPath ?? '').trim();
  if (!mountPath) return;
  try {
    localStorage.setItem(
      RECORD_VAULT_LAST_BACKUP_USB_LS_KEY,
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

export function clearRecordVaultLastBackupUsbLocation() {
  try {
    localStorage.removeItem(RECORD_VAULT_LAST_BACKUP_USB_LS_KEY);
  } catch {
    // ignore
  }
}

export function clearRecordVaultLastUsbLocation() {
  try {
    localStorage.removeItem(RECORD_VAULT_LAST_USB_LS_KEY);
  } catch {
    // ignore
  }
}
