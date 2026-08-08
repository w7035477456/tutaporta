import pool from '../../db/connection.js';
import { parseRegistrationMeta, referCodeFromRegistrationMeta } from '../../utils/registrationReferralMeta.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';

const LOG_PREFIX = '[verifyRegistrationLink]';

function formatPhoneDigitsForSignup(phoneDigitsRaw) {
  const digits = String(phoneDigitsRaw ?? '').replace(/\D/g, '');
  if (digits.length !== 10) return '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Read-only check: registration code exists, matches email, unused, not expired.
 * Used when the user opens /pages/createPassword?email=&code= from the email link.
 */
export async function verifyRegistrationLink(req, res) {
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
         AND kind = 'registration_email'
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

/**
 * POST /api/verifyRegistrationCode — body: { code }
 * Used when the user opens /verifyemail and enters the code from the registration email.
 */
export async function verifyRegistrationCode(req, res) {
  try {
    const code = String(req.body?.code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code.length !== 6) {
      return res.status(400).json({ valid: false, error: 'A 6-character verification code is required.' });
    }

    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM helloworldjunktest.verifications
       WHERE code = $1
         AND kind = 'registration_email'
         AND used_at IS NULL
         AND expires_at > now()`,
      [code]
    );
    const row = result.rows[0];
    if (!row) {
      console.log(LOG_PREFIX, 'manual code invalid: no matching unused non-expired code');
      return res.status(200).json({ valid: false });
    }

    const meta = parseRegistrationMeta(row.password_hash);
    const metaRef = referCodeFromRegistrationMeta(row.password_hash);
    const phone = formatPhoneDigitsForSignup(meta.phone_digits);

    return res.status(200).json({
      valid: true,
      email: String(row.email).trim().toLowerCase(),
      phone,
      ref: metaRef,
      token: metaRef
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'verifyRegistrationCode', err);
    return res.status(500).json({ valid: false, error: 'Failed to verify code' });
  }
}
