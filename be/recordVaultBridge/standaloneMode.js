/**
 * End-user USB bridge runs without Postgres, JWT keys, or ~/.ssh/be/.env.
 * Set RECORD_VAULT_BRIDGE_STANDALONE=1 before importing BE modules (see index.js).
 */
export function isRecordVaultBridgeStandalone() {
  return String(process.env.RECORD_VAULT_BRIDGE_STANDALONE || '').trim() === '1';
}
