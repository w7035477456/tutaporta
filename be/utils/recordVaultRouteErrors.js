/**
 * Shared Record Vault route error → JSON response.
 * Maps filesystem permission faults to a clear admin message instead of a bare 500.
 */
import {
  isStoragePermissionError,
  respondVaultStoragePermissionError
} from './storagePermissionError.js';

const DISK_FULL_RE = /no space left on device|ENOSPC/i;

export function isStorageDiskFullError(err) {
  if (!err) return false;
  if (err.code === 'ENOSPC') return true;
  return DISK_FULL_RE.test(String(err.message || err));
}

export function vaultDiskFullUserMessage() {
  return (
    'Disk is full where TutaNotes saves files (Mac local vault folder or server storage). ' +
    'Free space on that computer — this is not the TutaNotes 10GB cloud transfer bar. ' +
    'Then save or upload again.'
  );
}

/**
 * @param {import('express').Response} res
 * @param {unknown} err
 * @param {string} fallback
 * @param {{ status?: number, route?: string, singlesId?: number|null }} [opts]
 */
export function sendRecordVaultError(res, err, fallback, opts = {}) {
  if (isStoragePermissionError(err)) {
    return respondVaultStoragePermissionError(res, err, {
      route: opts.route || 'recordVault',
      singlesId: opts.singlesId ?? null
    });
  }
  if (isStorageDiskFullError(err)) {
    return res.status(507).json({ error: vaultDiskFullUserMessage(), code: 'STORAGE_DISK_FULL' });
  }
  const status = Number(opts.status) || 500;
  const message = err?.message || fallback;
  if (status >= 500) {
    console.error(`[${opts.route || 'recordVault'}]`, err?.stack || err?.message || err);
  }
  return res.status(status).json({ error: message });
}
