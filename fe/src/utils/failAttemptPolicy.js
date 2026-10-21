/**
 * Mirrors be/utils/failAttemptPolicy.js:
 *   fails 1–2 → retry immediately; 3rd consecutive fail → retry cooldown;
 *   fails 4–5 → retry immediately; 6th consecutive fail → lock (or USB wipe).
 */

export const FAIL_COOLDOWN_AT_ATTEMPT = 3;
export const FAIL_LOCK_AT_ATTEMPT = 6;

/**
 * @param {number} failedAttempts consecutive fails so far
 * @param {string} lockConsequence e.g. "lock TutaNotes, and you must contact tech support after that"
 */
export function failAttemptWarning(failedAttempts, lockConsequence) {
  const n = Math.max(0, Math.floor(Number(failedAttempts) || 0));
  if (n < FAIL_COOLDOWN_AT_ATTEMPT) {
    return `${FAIL_COOLDOWN_AT_ATTEMPT} fails in a row start a retry cooldown, and ${FAIL_LOCK_AT_ATTEMPT - FAIL_COOLDOWN_AT_ATTEMPT} more fails after that will ${lockConsequence}.`;
  }
  const left = Math.max(1, FAIL_LOCK_AT_ATTEMPT - n);
  return `${left} more fail${left === 1 ? '' : 's'} will ${lockConsequence}.`;
}
