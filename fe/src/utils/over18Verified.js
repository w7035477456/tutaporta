/** Product copy when over_18_verified is false (OK → logout). */
export const OVER18_REQUIRED_SITE_MESSAGE = 'Over 18 is required to use this site';

/**
 * Normalize over_18_verified to true | false | null.
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
 * NULL / missing — must complete Identification Verification DOB check.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isOver18VerificationPending(raw) {
  return normalizeOver18Verified(raw) == null;
}
