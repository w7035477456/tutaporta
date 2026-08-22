import appLog from '../logger.js';

export const MOBILE_PHOTO_UPLOAD_LOG_PREFIX = '[mobilePhotoUpload]';

/** When true, traceMobilePhotoUpload always console.logs (PM2 app-out) regardless of PM2_LOG_LEVEL. */
export function isMobilePhotoUploadVerbose() {
  const raw = String(process.env.MOBILE_PHOTO_UPLOAD_DEBUG ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  const level = String(process.env.PM2_LOG_LEVEL ?? 'INFO').trim().toUpperCase();
  return level === 'TRACE' || level === 'DEBUG';
}

/** Safe token for logs — prefix + length only. */
export function maskMobileUploadToken(token) {
  const t = String(token ?? '').trim();
  if (!t) return '(empty)';
  if (t.length <= 10) return `${t.slice(0, 4)}…`;
  return `${t.slice(0, 10)}…(${t.length})`;
}

export function formatMobileUploadBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Standard request metadata for mobile upload logs. */
export function mobileUploadRequestContext(req) {
  const cl = req?.get?.('content-length') ?? req?.headers?.['content-length'];
  const clNum = cl ? parseInt(String(cl), 10) : NaN;
  const token =
    String(req?.query?.token ?? req?.params?.token ?? '').trim().replace(/\s+/g, '') || null;
  return {
    method: req?.method,
    path: req?.originalUrl || req?.path,
    ip: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown',
    token: token ? maskMobileUploadToken(token) : null,
    contentType: String(req?.headers?.['content-type'] ?? '').slice(0, 120) || null,
    contentLength: cl || null,
    contentLengthBytes: Number.isFinite(clNum) ? clNum : null,
    contentLengthLabel: Number.isFinite(clNum) ? formatMobileUploadBytes(clNum) : null,
    accept: String(req?.headers?.accept ?? '').slice(0, 80) || null,
    userAgent: String(req?.headers?.['user-agent'] ?? '').slice(0, 120) || null,
    singlesId: req?.auth?.singles_id ?? null
  };
}

/** Always visible in PM2 app-out — use for barcode upload pipeline tracing. */
export function traceMobilePhotoUpload(message, details) {
  if (details !== undefined) {
    console.log(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message, details);
  } else {
    console.log(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message);
  }
}

export function debugMobilePhotoUpload(message, details) {
  if (isMobilePhotoUploadVerbose()) {
    traceMobilePhotoUpload(`DEBUG ${message}`, details);
    return;
  }
  if (details !== undefined) {
    appLog.debug(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message, details);
  } else {
    appLog.debug(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message);
  }
}

/** Visible at PM2 default log level when phone upload fails. */
export function warnMobilePhotoUpload(message, details) {
  if (details !== undefined) {
    appLog.warn(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message, details);
    traceMobilePhotoUpload(`WARN ${message}`, details);
  } else {
    appLog.warn(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message);
    traceMobilePhotoUpload(`WARN ${message}`);
  }
}

/** Always visible in PM2 logs (INFO) — use for phone scan / validate tracing. */
export function infoMobilePhotoUpload(message, details) {
  if (details !== undefined) {
    appLog.info(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message, details);
  } else {
    appLog.info(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message);
  }
}

export function errorMobilePhotoUpload(message, err, extra) {
  const detail = {
    message: err?.message ?? String(err ?? ''),
    code: err?.code,
    stack: isMobilePhotoUploadVerbose() ? err?.stack : undefined,
    ...extra
  };
  appLog.error(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message, detail);
  traceMobilePhotoUpload(`ERROR ${message}`, detail);
}
