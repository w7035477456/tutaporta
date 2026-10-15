import { attachAuthIfPresent } from './attachAuthIfPresent.js';
import { estimateRequestBytes, patchResponseByteCounter } from './photoAlbumsTransferMeter.js';
import { trackVaultTransferBytes } from '../utils/vaultTransferTracking.js';

/** Usage / status polls — metering them would make the usage bar count itself. */
const SKIP_EXACT = new Set([
  '/api/recordVault/usage',
  '/api/recordVault/session-file-counts',
  '/api/recordVault/access/status',
  '/api/recordVault/access/fail-status',
  '/api/recordVault/rag/status',
  '/api/recordVault/tutadrive/status',
  '/api/recordVault/tutadrive/backup/status',
  '/api/recordVault/tutadrive/backup/needs-backup'
]);

function requestPath(req) {
  return String(req.originalUrl || req.url || req.path || '').split('?')[0];
}

function shouldMeterRecordVaultTransfer(path) {
  if (!path.startsWith('/api/recordVault')) return false;
  if (SKIP_EXACT.has(path)) return false;
  if (path.includes('progress')) return false;
  return true;
}

/**
 * Count every Tx/Rx byte for authenticated /api/recordVault/* traffic (TutaNotes usage bar total),
 * including backup Download / Upload / Restore / Merge / Open. Zips sent as PUT /api/tutadrive/upload-chunk
 * pieces are counted on the final request via `req.chunkedUploadBytes` (set by parseVaultBackupZipUpload).
 */
export function recordVaultTransferMeter(req, res, next) {
  const path = requestPath(req);
  if (!shouldMeterRecordVaultTransfer(path)) return next();

  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) return next();

  const reqBytes = estimateRequestBytes(req);

  patchResponseByteCounter(res, (resBytes) => {
    const chunkedBytes = Math.max(0, Number(req.chunkedUploadBytes) || 0);
    const totalBytes = reqBytes + chunkedBytes + resBytes;
    if (totalBytes <= 0) return;
    void trackVaultTransferBytes(singlesId, totalBytes);
  });

  next();
}

/** Mount on /api/recordVault before route handlers. */
export const recordVaultTransferMeterStack = [attachAuthIfPresent, recordVaultTransferMeter];
