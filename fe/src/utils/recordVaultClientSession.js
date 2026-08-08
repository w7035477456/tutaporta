/**
 * In-tab E2E vault session: holds DEK in memory only.
 * Cleared on logoff / tab close — never sent to server or Redis (cluster-safe).
 */
let dekCryptoKey = null;
let dekRawBytes = null;
let vaultMeta = null;

export function getRecordVaultE2eDek() {
  return dekCryptoKey;
}

export function getRecordVaultE2eDekRaw() {
  return dekRawBytes;
}

export function getRecordVaultE2eVaultMeta() {
  return vaultMeta;
}

export function isRecordVaultE2eUnlocked() {
  return Boolean(dekCryptoKey);
}

export function setRecordVaultE2eSession({ dek, dekRaw, vault } = {}) {
  dekCryptoKey = dek || null;
  dekRawBytes = dekRaw instanceof Uint8Array ? dekRaw : null;
  vaultMeta = vault
    ? {
        vaultId: vault.vaultId != null ? Number(vault.vaultId) : null,
        cryptoVersion: Number(vault.cryptoVersion) || 1,
        storageBackend: vault.storageBackend ? String(vault.storageBackend) : null
      }
    : null;
}

export function clearRecordVaultE2eSession() {
  dekCryptoKey = null;
  dekRawBytes = null;
  vaultMeta = null;
}
