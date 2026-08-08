import pool from '../../db/connection.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';

const LOG_PREFIX = '[verifyPasswordResetLink]';

/**
 * Read-only: password reset code exists, matches email, unused, not expired.
 */
export async function verifyPasswordResetLink(req, res) {
  try {
    const emailRaw = req.query.email;
    const codeRaw = req.query.code;
    if (!emailRaw || codeRaw === undefined || codeRaw === null || String(codeRaw).trim() === '') {
      return res.status(400).json({ valid: false, error: 'email and code query parameters are required' });
    }

    const emailNorm = normalizeEmailForDb(emailRaw);
    const code = String(codeRaw).trim().toUpperCase();

    const result = await pool.query(
      `SELECT id, email
       FROM helloworldjunktest.verifications
       WHERE code = $1
         AND kind = 'password_reset'
         AND used_at IS NULL
         AND expires_at > now()`,
      [code]
    );
    const row = result.rows[0];

    if (!row) {
      console.log(LOG_PREFIX, 'invalid: no matching unused non-expired code');
      return res.status(200).json({ valid: false });
    }

    if (normalizeEmailForDb(row.email) !== emailNorm) {
      console.log(LOG_PREFIX, 'invalid: email mismatch');
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error(LOG_PREFIX, err);
    return res.status(500).json({ valid: false, error: 'Failed to verify link' });
  }
}
