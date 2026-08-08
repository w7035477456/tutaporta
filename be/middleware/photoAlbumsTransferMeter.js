import { attachAuthIfPresent } from './attachAuthIfPresent.js';
import { trackVaultTransferBytes } from '../utils/photoAlbumsTransferTracking.js';

const BYTES_PER_MB = 1024 * 1024;

/** Endpoints that must not recurse or skew live quota (bridge batch reports, usage poll). */
const SKIP_EXACT = new Set([
  '/api/photoAlbums/transfer-bytes',
  '/api/photoAlbums/usage',
  '/api/photoAlbums/session-file-counts'
]);

/** High-frequency progress polls — skip to avoid drowning real work. */
const SKIP_PREFIXES = [
  '/api/photoAlbums/onedrive/open-progress',
  '/api/photoAlbums/onedrive/sync-progress',
  '/api/photoAlbums/onedrive/logoff-progress'
];

function requestPath(req) {
  return String(req.originalUrl || req.url || req.path || '').split('?')[0];
}

function shouldMeterPhotoAlbumsTransfer(path) {
  if (!path.startsWith('/api/photoAlbums')) return false;
  if (SKIP_EXACT.has(path)) return false;
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  return true;
}

function estimateRequestBytes(req) {
  const fromHeader = Number(req.headers['content-length']);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.floor(fromHeader);
  if (req.body == null) return 0;
  if (Buffer.isBuffer(req.body)) return req.body.length;
  if (typeof req.body === 'string') return Buffer.byteLength(req.body);
  try {
    return Buffer.byteLength(JSON.stringify(req.body));
  } catch {
    return 0;
  }
}

function patchResponseByteCounter(res, onComplete) {
  let resBytes = 0;
  const origWrite = res.write;
  const origEnd = res.end;

  res.write = function writeWithCount(chunk, encoding, cb) {
    if (chunk) {
      resBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    }
    if (typeof encoding === 'function') return origWrite.call(this, chunk, encoding);
    return origWrite.call(this, chunk, encoding, cb);
  };

  res.end = function endWithCount(chunk, encoding, cb) {
    if (chunk) {
      resBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    }
    try {
      onComplete(resBytes);
    } catch {
      // Quota tracking must never fail the response.
    }
    if (typeof encoding === 'function') return origEnd.call(this, chunk, encoding);
    return origEnd.call(this, chunk, encoding, cb);
  };
}

/**
 * Count every Tx/Rx byte for authenticated /api/photoAlbums/* traffic.
 * Runs after attachAuthIfPresent so req.auth is set when a session cookie exists.
 */
export function photoAlbumsTransferMeter(req, res, next) {
  const path = requestPath(req);
  if (!shouldMeterPhotoAlbumsTransfer(path)) return next();

  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) return next();

  const reqBytes = estimateRequestBytes(req);
  const startedAtMs = Date.now();

  patchResponseByteCounter(res, (resBytes) => {
    const totalBytes = reqBytes + resBytes;
    if (totalBytes <= 0) return;
    void trackVaultTransferBytes(singlesId, totalBytes, startedAtMs);
  });

  next();
}

/** Mount on /api/photoAlbums before route handlers. */
export const photoAlbumsTransferMeterStack = [attachAuthIfPresent, photoAlbumsTransferMeter];

export { BYTES_PER_MB };
