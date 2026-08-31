import pool from '../../db/connection.js';
import { isTwilioVerifyConfigured, sendTwilioVerificationSms } from '../../lib/twilioVerifySms.js';
import {
  formatPhoneForDuplicateCheck,
  respondIfDuplicatePhone
} from '../../utils/duplicatePhonePolicy.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { resolveSignupMemberCategory } from '../../utils/signupMemberCategory.js';
import { verifyGoogleSignupToken } from '../auth/googleSignupOAuth.js';

const LOG_PREFIX = '[sendRegistrationSms]';

/**
 * Send Twilio SMS during sign-up before the user sets a password.
 * Validates the registration email code **or** a Google signup token (does not consume either)
 * and opens a phone_verify_session.
 */
export async function sendRegistrationSms(req, res) {
  try {
    const { code: codeRaw, email, phone, signupToken: signupTokenRaw } = req.body;
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
    const signupToken = String(signupTokenRaw || '').trim();
    const emailNorm = normalizeEmailForDb(email);

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and phone are required.' });
    }

    if (signupToken) {
      if (!verifyGoogleSignupToken(signupToken, emailNorm)) {
        return res.status(400).json({
          error: 'Google sign-up session expired. Please click Sign up with Google again.'
        });
      }
    } else if (code) {
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
    } else {
      return res.status(400).json({
        error: 'Email, registration code (or Google sign-up token), and phone are required.'
      });
    }

    const formattedPhone = formatPhoneForDuplicateCheck(phone);
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }
    if (await respondIfDuplicatePhone(res, formattedPhone, resolveSignupMemberCategory(emailNorm))) return;

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(
      `DELETE FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind IN ('phone_verify_session', 'phone_verified_pending_password')
         AND used_at IS NULL`,
      [emailNorm, formattedPhone]
    );
    await pool.query(
      `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
       VALUES ($1, $2, NULL, 'phone_verify_session', $3)`,
      [emailNorm, formattedPhone, expiresAt]
    );

    await sendTwilioVerificationSms(formattedPhone);
    console.log(LOG_PREFIX, 'SMS sent', {
      emailPrefix: `${emailNorm.slice(0, 3)}***`,
      to: formattedPhone,
      via: signupToken ? 'google' : 'email_code'
    });
    return res.json({ success: true, message: 'Verification code sent to your phone' });
  } catch (error) {
    console.error(LOG_PREFIX, 'error', error.message || error);
    return res.status(500).json({
      error: 'Failed to send verification SMS',
      details: error.message || 'Please try again.'
    });
  }
}
