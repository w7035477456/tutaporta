import { verifyPassword } from './passwordHash.js';

export const PASSWORD_MAX_ATTEMPTS = 3;
/** After 3 failed attempts count becomes 4; block further submits (not HTTP 429 — that triggers site rate-limit UI). */
export const PASSWORD_LOCKOUT_COUNT = PASSWORD_MAX_ATTEMPTS + 1;
/** Sentinel stored in DB (column is NOT NULL) meaning “no active attempt window”. */
export const PASSWORD_ATTEMPT_EPOCH = '1970-01-01 00:00:00+00';

export const PASSWORD_MISMATCH_PRIMARY_DEFAULT =
  "The password you entered doesn't match our record.";

export const LOGIN_PASSWORD_MISMATCH_PRIMARY =
  "The password you entered doesn't match our records.";

export const PASSWORD_MAX_ATTEMPTS_MESSAGE =
  'Maximum attempts reached. Only 3 attempts per 24 hour period allowed.';

export function passwordMismatchMessage(attemptCount, { primary } = {}) {
  return {
    primary: primary ?? PASSWORD_MISMATCH_PRIMARY_DEFAULT,
    secondary: `This is your ${attemptCount} attempt. You are allowed up to ${PASSWORD_MAX_ATTEMPTS} attempts every 24 hours.`
  };
}

export function passwordAttemptLockoutResponse(attemptCount) {
  return {
    statusCode: 403,
    body: {
      error: PASSWORD_MAX_ATTEMPTS_MESSAGE,
      maxAttemptsReached: true,
      passwordAttemptCount: attemptCount
    }
  };
}

export function passwordAttemptMismatchResponse(displayAttemptCount, options = {}) {
  const mismatch = passwordMismatchMessage(displayAttemptCount, options);
  return {
    statusCode: 401,
    body: {
      error: `${mismatch.primary}\n${mismatch.secondary}`,
      errorPrimary: mismatch.primary,
      errorSecondary: mismatch.secondary,
      passwordAttemptCount: displayAttemptCount,
      maxAttemptsReached: false
    }
  };
}

/**
 * DB-backed password attempt gate (PostgreSQL singles.password_attempt_count /
 * password_attempt_datetime). Caller must BEGIN a transaction before calling. Does not COMMIT.
 *
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 * @param {string} plainPassword
 * @param {(storedHash: string, plain: string) => Promise<boolean>} checkPassword
 * @param {{ mismatchPrimary?: string }} [options]
 */
export async function verifyPasswordWithAttemptTracking(
  client,
  singlesId,
  plainPassword,
  checkPassword,
  options = {}
) {
  const userResult = await client.query(
    `SELECT password_hash, password_attempt_count, password_attempt_datetime, email, phone, member_category
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1
     FOR UPDATE`,
    [singlesId]
  );
  if (!userResult.rows.length) {
    return { ok: false, response: { statusCode: 404, body: { error: 'User profile not found' } } };
  }

  const row = userResult.rows[0];
  const storedHash = row.password_hash;
  if (!storedHash) {
    return { ok: false, response: { statusCode: 400, body: { error: 'No password is set on this account.' } } };
  }

  let attemptCount = Number(row.password_attempt_count);
  if (!Number.isFinite(attemptCount) || attemptCount < 0) {
    attemptCount = 0;
  }

  const resetResult = await client.query(
    `UPDATE helloworldjunktest.singles
     SET password_attempt_count = 1,
         password_attempt_datetime = NOW()
     WHERE singles_id = $1
       AND (
         password_attempt_datetime IS NULL
         OR password_attempt_datetime <= $2::timestamptz
         OR password_attempt_datetime < NOW() - INTERVAL '24 hours'
       )
     RETURNING password_attempt_count`,
    [singlesId, PASSWORD_ATTEMPT_EPOCH]
  );
  if (resetResult.rows.length) {
    attemptCount = Number(resetResult.rows[0].password_attempt_count) || 1;
  }

  if (attemptCount >= PASSWORD_LOCKOUT_COUNT) {
    return { ok: false, response: passwordAttemptLockoutResponse(attemptCount) };
  }

  let passwordValid = false;
  try {
    passwordValid = await checkPassword(String(storedHash).trim(), plainPassword);
  } catch (err) {
    console.error('[passwordAttemptTracking] checkPassword error:', err?.message || err);
    return { ok: false, response: { statusCode: 500, body: { error: 'Failed to verify password.' } } };
  }

  if (!passwordValid) {
    const displayAttemptCount = attemptCount;
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET password_attempt_count = password_attempt_count + 1,
           password_attempt_datetime = CASE
             WHEN password_attempt_datetime IS NULL
               OR password_attempt_datetime <= $2::timestamptz
             THEN NOW()
             ELSE password_attempt_datetime
           END
       WHERE singles_id = $1`,
      [singlesId, PASSWORD_ATTEMPT_EPOCH]
    );
    return {
      ok: false,
      response: passwordAttemptMismatchResponse(displayAttemptCount, {
        primary: options.mismatchPrimary
      })
    };
  }

  return { ok: true, row, attemptCount };
}

/** Settings change-password / change-email / change-phone gate. */
export async function verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent) {
  return verifyPasswordWithAttemptTracking(client, singlesId, plainCurrent, async (storedHash, plain) => {
    if (!storedHash) return false;
    return verifyPassword(storedHash, plain);
  });
}

export async function resetPasswordAttemptsOnSuccess(client, singlesId) {
  await client.query(
    `UPDATE helloworldjunktest.singles
     SET password_attempt_count = 1,
         password_attempt_datetime = $2::timestamptz
     WHERE singles_id = $1`,
    [singlesId, PASSWORD_ATTEMPT_EPOCH]
  );
}
