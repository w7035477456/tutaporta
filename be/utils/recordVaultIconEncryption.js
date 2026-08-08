/** When true, vault DB/photos/files use icon-key encryption; when false, stored unencrypted. */

function parseEnvBool(raw, defaultValue = false) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

export function isRecordVaultIconEncryptionEnabled() {
  return parseEnvBool(process.env.NOTES_ICON_ENCRYPTION, false);
}

export function vaultMetaUsesPlaintextStorage(meta) {
  return meta?.encryption === 'none' || Number(meta?.version) === 3;
}
