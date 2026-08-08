import pool from '../../db/connection.js';
import { isTwilioVerifyConfigured, sendTwilioVerificationSms } from '../../lib/twilioVerifySms.js';
import { isUndefinedTableError } from '../../lib/pgErrors.js';

const LOG_PREFIX = '[resendPhoneCode]';

export async function resendPhoneCode(req, res) {
  try {
    const { email, phone } = req.body;
    const emailNorm = String(email ?? '').trim().toLowerCase();

    if (!emailNorm) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const phoneDigits = String(phone ?? '').replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length !== 10) {
      return res.status(400).json({ error: 'Phone number must be 10 digits if provided.' });
    }

    const formattedPhoneFromBody = phoneDigits.length === 10 ? `+1${phoneDigits}` : null;

    let sessionRow_AAAAA = await pool.query(
      `SELECT id, phone, 'verifications' AS src
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND kind = 'phone_verify_session'
         AND used_at IS NULL
         AND expires_at > now()
         ${formattedPhoneFromBody ? 'AND phone = $2' : ''}
       ORDER BY created_at DESC
       LIMIT 1`,
      formattedPhoneFromBody ? [emailNorm, formattedPhoneFromBody] : [emailNorm]
    );

    if (!sessionRow_AAAAA.rows[0]) {
      try {
        sessionRow_AAAAA = await pool.query(
          `SELECT id, phone, 'pending_phone_verifications' AS src
           FROM helloworldjunktest.pending_phone_verifications
           WHERE email = $1
             AND used_at IS NULL
             AND expires_at > now()
             ${formattedPhoneFromBody ? 'AND phone = $2' : ''}
           ORDER BY created_at DESC
           LIMIT 1`,
          formattedPhoneFromBody ? [emailNorm, formattedPhoneFromBody] : [emailNorm]
        );
      } catch (e) {
        if (!isUndefinedTableError(e)) throw e;
        sessionRow_AAAAA = { rows: [] };
      }
    }

    if (!sessionRow_AAAAA.rows[0]) {
      return res.status(400).json({
        error: 'Verification session not found. Please start the verification process again.'
      });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const row = sessionRow_AAAAA.rows[0];
    const formattedPhone = row.phone;
    await sendTwilioVerificationSms(formattedPhone);

    console.log(LOG_PREFIX, 'resend SMS sent', { to: formattedPhone });
    return res.json({ success: true, message: 'Verification code sent to your phone.' });
  } catch (err) {
    console.error(LOG_PREFIX, err.message || err);
    return res.status(500).json({
      error: 'Failed to resend verification code',
      details: err.message || 'Please try again.'
    });
  }
}
