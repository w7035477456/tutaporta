/**
 * fe/.env SCAN_FOR_PHONE_UPLOAD_SEC — desktop polls phone upload session status (My Album & Postings QR).
 * Requires vite envPrefix SCAN_ (see vite.config.mjs).
 */

const DEFAULT_SCAN_FOR_PHONE_UPLOAD_SEC = 3;

/** @returns {number} poll interval in milliseconds */
export function getScanForPhoneUploadMs() {
  const parsed = Number(String(import.meta.env.SCAN_FOR_PHONE_UPLOAD_SEC ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SCAN_FOR_PHONE_UPLOAD_SEC * 1000;
  return Math.min(parsed, 120) * 1000;
}
