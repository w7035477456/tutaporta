import pool from '../../db/connection.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { hashPassword } from '../../utils/passwordHash.js';

const LOG_PREFIX = '[completePasswordReset]';

/**
 * POST /api/completePasswordReset — body: { email, code, password }
 */
export async function completePasswordReset(req, res) {
  try {
    const { email: emailRaw, code: codeRaw, password } = req.body;
    const emailNorm = normalizeEmailForDb(emailRaw);
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
    const plain = typeof password === 'string' ? password : '';

    if (!emailNorm || !code || !plain) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }
    if (plain.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

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
      return res.status(400).json({
        error: 'This reset link is invalid, expired, or already used. Please request a new password reset.'
      });
    }
    if (normalizeEmailForDb(row.email) !== emailNorm) {
      return res.status(400).json({ error: 'Email does not match the reset link.' });
    }

    const userCheck = await pool.query('SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1', [emailNorm]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No account found for this email.' });
    }

    const passwordHash = await hashPassword(plain);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
      await client.query(`UPDATE helloworldjunktest.singles SET password_hash = $1 WHERE email = $2`, [passwordHash, emailNorm]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    console.log(LOG_PREFIX, 'password updated', { emailPrefix: `${emailNorm.slice(0, 3)}***` });
    return res.json({ success: true, message: 'Your password has been updated. You can sign in now.' });
  } catch (err) {
    console.error(LOG_PREFIX, err);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
}
