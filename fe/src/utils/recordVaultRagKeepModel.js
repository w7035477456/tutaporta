const LS_KEY = 'recordVaultRagKeepModelInMemory';

export function loadRecordVaultRagKeepModelInMemory() {
  try {
    return sessionStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveRecordVaultRagKeepModelInMemory(enabled) {
  try {
    sessionStorage.setItem(LS_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota errors
  }
  return Boolean(enabled);
}
