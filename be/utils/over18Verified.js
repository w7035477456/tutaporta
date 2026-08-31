/** Product copy when over_18_verified is false while a session is still open. */
export const OVER18_REQUIRED_SITE_MESSAGE = 'Over 18 is required to use this site';

/**
 * Normalize DB / JSON over_18_verified to true | false | null.
 * @param {unknown} raw
 * @returns {boolean | null}
 */
export function normalizeOver18Verified(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'true' || s === '1' || s === 't' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'f' || s === 'no') return false;
  return null;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isOver18Verified(raw) {
  return normalizeOver18Verified(raw) === true;
}

/**
 * Pending age check — force Identification Verification.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isOver18VerificationPending(raw) {
  return normalizeOver18Verified(raw) == null;
}
