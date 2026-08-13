import pool from '../../db/connection.js';
import { isBypassSmsPhoneVerificationEnabled } from '../../utils/bypassSmsPhoneVerification.js';
import {
  formatPhoneForDuplicateCheck,
  respondIfDuplicatePhone
} from '../../utils/duplicatePhonePolicy.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { resolveSignupMemberCategory } from '../../utils/signupMemberCategory.js';

const LOG_PREFIX = '[bypassSignupSmsVerification]';

/**
 * POST /api/signup/bypass-sms-phone-verification
 * Body: { code, email, phone }
 * Dev/staging only when BY_PASS_SMS_PHONE_VERIFICATION=true.
 * Marks phone verified without Twilio; user proceeds to create password.
 */
export async function bypassSignupSmsVerification(req, res) {
  if (!isBypassSmsPhoneVerificationEnabled()) {
    return res.status(403).json({ error: 'SMS phone verification bypass is not enabled.' });
  }

  try {
    const { code: codeRaw, email, phone } = req.body;
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';

    if (!code || !email || !phone) {
      return res.status(400).json({ error: 'Email, registration code, and phone are required.' });
    }

    const emailNorm = normalizeEmailForDb(email);
    const formattedPhone = formatPhoneForDuplicateCheck(phone);
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }

    let row;
    try {
      const result = await pool.query(
        `SELECT id, email
         FROM helloworldjunktest.verifications
         WHERE code = $1
           AND kind = 'registration_email'
           AND used_at IS NULL
           AND expires_at > now()`,
        [code]
      );
      row = result.rows[0];
    } catch (dbErr) {
      console.error(LOG_PREFIX, 'DB error looking up code', dbErr.message);
      return res.status(500).json({ error: 'Failed to verify code. Please try again.' });
    }

    if (!row) {
      return res.status(400).json({
        error: 'This code is invalid, expired, or already used. Please request a new registration email.'
      });
    }
    if (normalizeEmailForDb(row.email) !== emailNorm) {
      return res.status(400).json({
        error: 'Email does not match the registration. Please use the email that received the code.'
      });
    }

    if (await respondIfDuplicatePhone(res, formattedPhone, resolveSignupMemberCategory(emailNorm))) return;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      `DELETE FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind IN ('phone_verify_session', 'phone_verified_pending_password')
         AND used_at IS NULL`,
      [emailNorm, formattedPhone]
    );

    const pending = await pool.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = 'phone_verified_pending_password'
         AND used_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [emailNorm, formattedPhone]
    );

    if (!pending.rows[0]) {
      await pool.query(
        `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
         VALUES ($1, $2, NULL, 'phone_verified_pending_password', $3)`,
        [emailNorm, formattedPhone, expiresAt]
      );
    }

    console.log(LOG_PREFIX, 'phone marked verified (bypass)', {
      emailPrefix: `${emailNorm.slice(0, 3)}***`,
      to: formattedPhone
    });

    return res.json({
      success: true,
      needsPassword: true,
      bypassed: true,
      message: 'Phone verified (bypass). Please create your password to finish registration.'
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'error', error.message || error);
    return res.status(500).json({ error: 'Failed to bypass SMS verification.' });
  }
}
