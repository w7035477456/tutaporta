/**
 * Shared wrong-password / wrong-icon policy:
 *   fails 1–2 → retry immediately; 3rd consecutive fail → retry cooldown;
 *   fails 4–5 → retry immediately; 6th consecutive fail → lock (or USB wipe).
 */

export const FAIL_COOLDOWN_AT_ATTEMPT = 3;
export const FAIL_LOCK_AT_ATTEMPT = 6;

/** True when this consecutive-fail count starts a retry cooldown. */
export function failAttemptStartsCooldown(failedAttempts) {
  return Math.floor(Number(failedAttempts) || 0) === FAIL_COOLDOWN_AT_ATTEMPT;
}

/** True when this consecutive-fail count locks the app (or wipes the USB vault). */
export function failAttemptLocks(failedAttempts) {
  return Math.floor(Number(failedAttempts) || 0) >= FAIL_LOCK_AT_ATTEMPT;
}

/**
 * Warning sentence after a fail, e.g.
 *   1–2: "3 fails in a row start a retry cooldown, and 3 more fails after that will lock TutaNotes, and you must contact tech support after that."
 *   3–5: "3 more fails will lock TutaNotes, and you must contact tech support after that."
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
