import { PASSWORD_ATTEMPT_EPOCH } from './passwordAttemptTracking.js';

export const SECRET_ICON_MAX_ATTEMPTS = 3;
/** After 3 failed attempts count becomes 4; block further submits. */
export const SECRET_ICON_LOCKOUT_COUNT = SECRET_ICON_MAX_ATTEMPTS + 1;
export const SECRET_ICON_ATTEMPT_EPOCH = PASSWORD_ATTEMPT_EPOCH;

export const SECRET_ICON_MISMATCH_ERROR = 'Security icon does not match. Please try again.';
export const SECRET_ICON_MAX_ATTEMPTS_MESSAGE =
  'Maximum attempts reached. Only 3 attempts per 24 hour period allowed.';

export function secretIconAttemptHint(displayAttemptCount) {
  return `This is your ${displayAttemptCount} attempt. You are allowed up to ${SECRET_ICON_MAX_ATTEMPTS} attempts every 24 hours.`;
}

export function secretIconAttemptLockoutResponse(attemptCount) {
  return {
    statusCode: 403,
    body: {
      valid: false,
      error: SECRET_ICON_MAX_ATTEMPTS_MESSAGE,
      maxAttemptsReached: true,
      secretIconAttemptCount: attemptCount
    }
  };
}

export function secretIconAttemptMismatchResponse(displayAttemptCount) {
  return {
    statusCode: 403,
    body: {
      valid: false,
      error: SECRET_ICON_MISMATCH_ERROR,
      errorSecondary: secretIconAttemptHint(displayAttemptCount),
      secretIconAttemptCount: displayAttemptCount,
      maxAttemptsReached: false
    }
  };
}

/**
 * DB-backed security-icon verify gate (PostgreSQL singles.secret_icon_attempt_count /
 * secret_icon_attempt_datetime). Caller must BEGIN a transaction before calling. Does not COMMIT.
 *
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 * @param {string} candidateHash — SHA-256 hex of normalized icon name
 */
export async function verifySecretIconWithAttemptTracking(client, singlesId, candidateHash) {
  if (!candidateHash) {
    return { ok: false, response: { statusCode: 400, body: { valid: false, error: 'Please choose a valid security icon.' } } };
  }

  const userResult = await client.query(
    `SELECT secret_icon, secret_icon_attempt_count, secret_icon_attempt_datetime
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1
     FOR UPDATE`,
    [singlesId]
  );
  if (!userResult.rows.length) {
    return { ok: false, response: { statusCode: 404, body: { valid: false, error: 'User profile not found' } } };
  }

  const row = userResult.rows[0];
  const stored = String(row.secret_icon ?? '').trim().toLowerCase();
  if (!stored) {
    return { ok: false, response: { statusCode: 400, body: { valid: false, error: 'No security icon is set on this account.' } } };
  }

  let attemptCount = Number(row.secret_icon_attempt_count);
  if (!Number.isFinite(attemptCount) || attemptCount < 0) {
    attemptCount = 0;
  }

  const resetResult = await client.query(
    `UPDATE helloworldjunktest.singles
     SET secret_icon_attempt_count = 1,
         secret_icon_attempt_datetime = NOW()
     WHERE singles_id = $1
       AND (
         secret_icon_attempt_datetime IS NULL
         OR secret_icon_attempt_datetime <= $2::timestamptz
         OR secret_icon_attempt_datetime < NOW() - INTERVAL '24 hours'
       )
     RETURNING secret_icon_attempt_count`,
    [singlesId, SECRET_ICON_ATTEMPT_EPOCH]
  );
  if (resetResult.rows.length) {
    attemptCount = Number(resetResult.rows[0].secret_icon_attempt_count) || 1;
  }

  if (attemptCount >= SECRET_ICON_LOCKOUT_COUNT) {
    return { ok: false, response: secretIconAttemptLockoutResponse(attemptCount) };
  }

  if (stored === candidateHash) {
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET secret_icon_attempt_count = 1,
           secret_icon_attempt_datetime = $2::timestamptz
       WHERE singles_id = $1`,
      [singlesId, SECRET_ICON_ATTEMPT_EPOCH]
    );
    return { ok: true };
  }

  const displayAttemptCount = attemptCount;
  await client.query(
    `UPDATE helloworldjunktest.singles
     SET secret_icon_attempt_count = secret_icon_attempt_count + 1,
         secret_icon_attempt_datetime = CASE
           WHEN secret_icon_attempt_datetime IS NULL
             OR secret_icon_attempt_datetime <= $2::timestamptz
           THEN NOW()
           ELSE secret_icon_attempt_datetime
         END
     WHERE singles_id = $1`,
    [singlesId, SECRET_ICON_ATTEMPT_EPOCH]
  );

  return { ok: false, response: secretIconAttemptMismatchResponse(displayAttemptCount) };
}
