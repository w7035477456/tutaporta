/**
 * Locked Subscription password.
 *   GET  /api/subscriptionLock/status  → { hasPassword }
 *   POST /api/subscriptionLock/unlock  { password, confirm? } → { token, expiresAt }
 *        No password yet: sets it (confirm must match). Otherwise verifies it.
 * After 5 wrong passwords the lock refuses attempts for 5 minutes (state in Postgres).
 */
import pool from '../../db/connection.js';
import { hashPassword, verifyPassword } from '../../utils/passwordHash.js';
import { issueSubscriptionUnlockToken } from '../../utils/subscriptionLockToken.js';

const T = 'outdateddbsnapshotoct2024.subscription_lock';
const MAX_FAILS = 5;
const LOCKOUT_MINUTES = 5;
const MIN_LEN = 4;
const MAX_LEN = 200;

function singlesIdOf(req) {
  const n = Math.trunc(Number(req.auth?.singles_id));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fail(res, status, error, code) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

function dbError(res, err) {
  if (String(err?.code) === '42P01' || String(err?.code) === '42703') {
    return fail(res, 500, 'Locked Subscription tables are missing — run dbmigrate (scripts/db-migrate.sh).');
  }
  console.error('[subscription-lock]', err?.message, err?.code);
  return fail(res, 500, 'Locked Subscription request failed');
}

export async function getSubscriptionLockStatus(req, res) {
  const singlesId = singlesIdOf(req);
  if (!singlesId) return fail(res, 401, 'Authentication required');
  try {
    const { rows } = await pool.query(`SELECT 1 FROM ${T} WHERE singles_id = $1`, [singlesId]);
    return res.json({ hasPassword: rows.length > 0 });
  } catch (err) {
    return dbError(res, err);
  }
}

export async function postSubscriptionUnlock(req, res) {
  const singlesId = singlesIdOf(req);
  if (!singlesId) return fail(res, 401, 'Authentication required');
  const password = String(req.body?.password ?? '');
  if (!password) return fail(res, 400, 'Enter your Locked Subscription password.');
  if (password.length > MAX_LEN) return fail(res, 400, `Password must be at most ${MAX_LEN} characters.`);
  try {
    const { rows } = await pool.query(
      `SELECT password_hash, failed_attempts,
              (locked_until IS NOT NULL AND locked_until > now()) AS throttled,
              CEIL(EXTRACT(EPOCH FROM (locked_until - now())) / 60)::int AS minutes_left
         FROM ${T} WHERE singles_id = $1`,
      [singlesId]
    );

    if (!rows[0]) {
      // First use: set the password.
      if (password.length < MIN_LEN) {
        return fail(res, 400, `Password must be at least ${MIN_LEN} characters.`);
      }
      if (String(req.body?.confirm ?? '') !== password) {
        return fail(res, 400, 'The two passwords do not match.');
      }
      const hash = await hashPassword(password);
      const { rowCount } = await pool.query(
        `INSERT INTO ${T} (singles_id, password_hash) VALUES ($1, $2) ON CONFLICT (singles_id) DO NOTHING`,
        [singlesId, hash]
      );
      if (!rowCount) return fail(res, 409, 'A password was just set elsewhere — enter that password.', 'HAS_PASSWORD');
      return res.json({ ok: true, created: true, ...issueSubscriptionUnlockToken(singlesId) });
    }

    const lock = rows[0];
    if (lock.throttled) {
      return fail(
        res,
        429,
        `Too many wrong passwords. Try again in ${Math.max(1, Number(lock.minutes_left) || 1)} minute(s).`
      );
    }
    if (!(await verifyPassword(lock.password_hash, password))) {
      await pool.query(
        `UPDATE ${T}
            SET failed_attempts = CASE WHEN failed_attempts + 1 >= $2 THEN 0 ELSE failed_attempts + 1 END,
                locked_until = CASE WHEN failed_attempts + 1 >= $2
                                    THEN now() + make_interval(mins => $3) ELSE locked_until END,
                updated_at = now()
          WHERE singles_id = $1`,
        [singlesId, MAX_FAILS, LOCKOUT_MINUTES]
      );
      return fail(res, 401, 'Wrong password.', 'BAD_PASSWORD');
    }
    if (Number(lock.failed_attempts) > 0) {
      await pool.query(
        `UPDATE ${T} SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE singles_id = $1`,
        [singlesId]
      );
    }
    return res.json({ ok: true, created: false, ...issueSubscriptionUnlockToken(singlesId) });
  } catch (err) {
    return dbError(res, err);
  }
}
