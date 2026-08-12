import pool from '../../db/connection.js';
import { insertNewSinglesAccount } from '../../utils/newSinglesAccount.js';
import { referCodeFromMemberId } from '../../utils/referCodeFromMemberId.js';
import { resolveReferByCode, resolveReferByCodeForSignup } from '../../utils/referByCode.js';
import { referCodeFromRegistrationMeta } from '../../utils/registrationReferralMeta.js';
import { isTwilioVerifyConfigured, sendTwilioVerificationSms } from '../../lib/twilioVerifySms.js';
import {
  formatPhoneForDuplicateCheck,
  isDuplicatePhoneAllowed,
  respondIfDuplicatePhone
} from '../../utils/duplicatePhonePolicy.js';
import { processReferralSignupReward } from '../../utils/referralSignupReward.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { recordAuditRegistrationChange } from '../../utils/insertAuditRegistration.js';
import { hashPassword } from '../../utils/passwordHash.js';
import { attachOrInsertSignupLoginLog } from '../../utils/loginLog.js';

const LOG_PREFIX = '[createPassword]';

export async function createPassword(req, res) {
  try {
    const { code: codeRaw, email, password, phone, sendSms, referByCode: referByCodeRaw, ref: refRaw, token: tokenRaw } =
      req.body;
    const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
    const shouldSendSms = sendSms === undefined ? true : Boolean(sendSms);
    console.log(LOG_PREFIX, 'called', { email: email ? `${email.slice(0, 3)}***` : null, hasCode: !!code, hasPhone: !!phone });

    if (!code || !email || !password || !phone) {
      console.log(LOG_PREFIX, 'reject: missing body', { hasCode: !!code, hasEmail: !!email, hasPassword: !!password, hasPhone: !!phone });
      return res.status(400).json({ error: 'Email, registration code, password, and phone are required.' });
    }

    const emailNorm = normalizeEmailForDb(email);
    const phoneDigitsEarly = String(phone ?? '').replace(/\D/g, '');
    const formattedPhoneEarly = phoneDigitsEarly.length === 10 ? `+1${phoneDigitsEarly}` : null;

    let row;
    try {
      const result = await pool.query(
        `SELECT id, email, expires_at, password_hash
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
      console.log(LOG_PREFIX, 'reject: code not found or expired or already used');
      return res.status(400).json({
        error: 'This code is invalid, expired, or already used. Please request a new registration email.'
      });
    }
    if (normalizeEmailForDb(row.email) !== emailNorm) {
      console.log(LOG_PREFIX, 'reject: email mismatch');
      return res.status(400).json({ error: 'Email does not match the registration. Please use the email that received the code.' });
    }

    const resolvedReferByCode = resolveReferByCodeForSignup({
      referByCode: referByCodeRaw,
      ref: refRaw,
      token: tokenRaw,
      metaRef: referCodeFromRegistrationMeta(row.password_hash)
    });

    if (formattedPhoneEarly && password && !shouldSendSms) {
      const pendingPhone = await pool.query(
        `SELECT id
         FROM helloworldjunktest.verifications
         WHERE email = $1
           AND phone = $2
           AND kind = 'phone_verified_pending_password'
           AND used_at IS NULL
           AND expires_at > now()`,
        [emailNorm, formattedPhoneEarly]
      );
      if (pendingPhone.rows[0]) {
        return finishRegistrationAfterPhoneVerified(req, res, {
          code,
          emailNorm,
          password,
          formattedPhone: formattedPhoneEarly,
          pendingRowId: pendingPhone.rows[0].id,
          referByCode: resolvedReferByCode
        });
      }
    }

    // Keep registration_email code valid until signup completes (verifyPhone / finishRegistration).
    console.log(LOG_PREFIX, 'code validated', { emailPrefix: `${emailNorm.slice(0, 3)}***` });

    const formattedPhone = formatPhoneForDuplicateCheck(phone);
    if (!formattedPhone) {
      console.log(LOG_PREFIX, 'reject: phone not 10 digits');
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }
    if (isDuplicatePhoneAllowed()) {
      console.log(LOG_PREFIX, 'DUPLICATE_PHONE_ALLOW=true: skipping duplicate phone check');
    } else if (await respondIfDuplicatePhone(res, formattedPhone)) {
      console.log(LOG_PREFIX, 'reject: phone already in use');
      return;
    }

    const passwordHash_AAAAA = await hashPassword(password);
    const expiresAt_AAAAA = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await pool.query(
      `DELETE FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = 'phone_verify_session'
         AND used_at IS NULL`,
      [emailNorm, formattedPhone]
    );

    if (!shouldSendSms) {
      await pool.query(
        `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
         VALUES ($1, $2, $3, 'phone_verify_session', $4)`,
        [emailNorm, formattedPhone, passwordHash_AAAAA, expiresAt_AAAAA]
      );
      console.log(LOG_PREFIX, 'session created without sending SMS', { to: formattedPhone });
      return res.json({ success: true, message: 'Password created. Ready to send SMS verification.' });
    }

    if (!isTwilioVerifyConfigured()) {
      console.error(LOG_PREFIX, 'Twilio Verify not configured');
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    await pool.query(
      `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
       VALUES ($1, $2, $3, 'phone_verify_session', $4)`,
      [emailNorm, formattedPhone, passwordHash_AAAAA, expiresAt_AAAAA]
    );

    console.log(LOG_PREFIX, 'code valid, sending SMS via Twilio Verify', { to: formattedPhone });
    try {
      await sendTwilioVerificationSms(formattedPhone);

      console.log(LOG_PREFIX, 'SMS verification sent', { to: formattedPhone });
      return res.json({ success: true, message: 'Verification code sent to your phone' });
    } catch (error) {
      console.error(LOG_PREFIX, 'Twilio Verify SMS error (link was valid; failure is SMS/config)', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return res.status(500).json({
        error: 'Failed to send verification SMS',
        details: error.message || 'Please check Twilio Verify configuration.'
      });
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'unexpected error (not link stale)', { message: error.message, stack: error.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process password creation' });
    }
  }
}

async function finishRegistrationAfterPhoneVerified(
  req,
  res,
  { code, emailNorm, password, formattedPhone, pendingRowId, referByCode }
) {
  const resolvedReferByCode = resolveReferByCode(referByCode);
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
    console.error(LOG_PREFIX, 'DB error looking up registration code', dbErr.message);
    return res.status(500).json({ error: 'Failed to verify code. Please try again.' });
  }

  if (!row) {
    return res.status(400).json({
      error: 'This code is invalid, expired, or already used. Please request a new registration email.'
    });
  }
  if (normalizeEmailForDb(row.email) !== emailNorm) {
    return res.status(400).json({ error: 'Email does not match the registration. Please use the email that received the code.' });
  }

  if (await respondIfDuplicatePhone(res, formattedPhone)) return;

  const passwordHash = await hashPassword(password);

  try {
    const existingUser = await pool.query(
      'SELECT singles_id, member_id FROM helloworldjunktest.singles WHERE email = $1',
      [emailNorm]
    );
    if (existingUser.rows.length > 0) {
      const memberId = existingUser.rows[0]?.member_id;
      const existingSinglesId = existingUser.rows[0]?.singles_id;
        await pool.query(
          `UPDATE helloworldjunktest.singles
           SET password_hash = $1,
               phone = $2,
               status = 'active'::helloworldjunktest.singles_status,
               my_refer_code = COALESCE(my_refer_code, $4),
               refer_by_code = COALESCE(refer_by_code, $5),
               updated_at = CURRENT_TIMESTAMP
           WHERE email = $3`,
          [passwordHash, formattedPhone, emailNorm, referCodeFromMemberId(memberId), resolvedReferByCode]
        );
      await recordAuditRegistrationChange(pool, {
        singlesId: existingSinglesId,
        email: emailNorm,
        phone: formattedPhone
      });
    } else {
      const account = await insertNewSinglesAccount(pool, {
        emailNorm,
        passwordHash,
        formattedPhone,
        referByCode: resolvedReferByCode
      });
      await processReferralSignupReward({
        newSinglesId: account.singlesId,
        newMemberId: account.memberId,
        newMemberEmail: emailNorm,
        referByCode: account.referByCode,
        isNewAccount: true
      });
      await attachOrInsertSignupLoginLog(req, {
        singlesId: account.singlesId,
        email: emailNorm,
        phone: formattedPhone
      });
    }

    await pool.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
    await pool.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [pendingRowId]);
    await pool.query(`DELETE FROM helloworldjunktest.verifications WHERE email = $1 AND used_at IS NULL`, [emailNorm]);

    console.log(LOG_PREFIX, 'registration completed after phone + password', { emailPrefix: `${emailNorm.slice(0, 3)}***` });
    return res.json({ success: true, message: 'Account created successfully.' });
  } catch (err) {
    console.error(LOG_PREFIX, 'finishRegistrationAfterPhoneVerified error', err.message || err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
}
