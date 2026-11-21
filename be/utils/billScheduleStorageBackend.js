/** Vault side for Bill Schedule rows: Cloud (tutaCloud) | USB. */
import { normalizeVaultStorageType, VAULT_CLOUD_STORAGE_TYPE } from './vaultStorageType.js';

export function parseBillStorageBackend(raw) {
  return normalizeVaultStorageType(raw, VAULT_CLOUD_STORAGE_TYPE);
}

export function readBillStorageBackend(req) {
  const fromQuery = req?.query?.storageType ?? req?.query?.storage_backend;
  const fromBody = req?.body?.storageType ?? req?.body?.storage_backend;
  return parseBillStorageBackend(fromQuery ?? fromBody ?? VAULT_CLOUD_STORAGE_TYPE);
}
