/**
 * Shared Record Vault route error → JSON response.
 * Maps filesystem permission faults to a clear admin message instead of a bare 500.
 */
import {
  isStoragePermissionError,
  respondVaultStoragePermissionError
} from './storagePermissionError.js';

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
  const status = Number(opts.status) || 500;
  const message = err?.message || fallback;
  if (status >= 500) {
    console.error(`[${opts.route || 'recordVault'}]`, err?.stack || err?.message || err);
  }
  return res.status(status).json({ error: message });
}
