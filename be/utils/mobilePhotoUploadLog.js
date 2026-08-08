import appLog from '../logger.js';

export const MOBILE_PHOTO_UPLOAD_LOG_PREFIX = '[mobilePhotoUpload]';

/** Safe token for logs — prefix + length only. */
export function maskMobileUploadToken(token) {
  const t = String(token ?? '').trim();
  if (!t) return '(empty)';
  if (t.length <= 10) return `${t.slice(0, 4)}…`;
  return `${t.slice(0, 10)}…(${t.length})`;
}

export function debugMobilePhotoUpload(message, details) {
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
  } else {
    appLog.warn(MOBILE_PHOTO_UPLOAD_LOG_PREFIX, message);
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
