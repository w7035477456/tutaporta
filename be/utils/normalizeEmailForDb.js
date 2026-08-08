/**
 * Normalize email before writing to or comparing with helloworldjunktest.singles.email (text).
 * Store and compare lowercase in application code.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeEmailForDb(raw) {
  return String(raw ?? '').trim().toLowerCase();
}
