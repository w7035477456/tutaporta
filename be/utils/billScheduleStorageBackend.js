/** Vault side for Bill Schedule rows: Cloud (onedrive/TutaDrive) | USB. */

export function parseBillStorageBackend(raw) {
  return String(raw ?? '').trim().toLowerCase() === 'usb' ? 'usb' : 'onedrive';
}

export function readBillStorageBackend(req) {
  const fromQuery = req?.query?.storageType ?? req?.query?.storage_backend;
  const fromBody = req?.body?.storageType ?? req?.body?.storage_backend;
  return parseBillStorageBackend(fromQuery ?? fromBody ?? 'onedrive');
}
