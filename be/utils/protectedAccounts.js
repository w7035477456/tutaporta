import pool from '../db/connection.js';

/**
 * PROTECT_ACCOUNTS (BE .env) — comma-separated emails whose singles rows Admin Tools may not
 * Cascd Del / Default Reset / Factory Reset / Login # Reset (also the Wipe by Id deletes).
 *   PROTECT_ACCOUNTS=a7035477456@gmail.com,other@example.com
 */
export const PROTECTED_ACCOUNT_ERROR = 'Protected account (PROTECT_ACCOUNTS) — this admin action is disabled for this member.';

export function protectedAccountEmails() {
  return new Set(
    String(process.env.PROTECT_ACCOUNTS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isProtectedAccountEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return Boolean(e) && protectedAccountEmails().has(e);
}

/** @param {import('pg').Pool | import('pg').PoolClient} [db] */
export async function isProtectedAccountSinglesId(singlesId, db = pool) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1 || !protectedAccountEmails().size) return false;
  const { rows } = await db.query(`SELECT email FROM outdateddbsnapshotoct2024.singles WHERE singles_id = $1 LIMIT 1`, [id]);
  return isProtectedAccountEmail(rows[0]?.email);
}

/** @returns {Promise<boolean>} true when the admin action may proceed; otherwise a 403 was sent. */
export async function allowAdminActionOnAccount(res, singlesId, db = pool) {
  if (!(await isProtectedAccountSinglesId(singlesId, db))) return true;
  res.status(403).json({ error: PROTECTED_ACCOUNT_ERROR });
  return false;
}
