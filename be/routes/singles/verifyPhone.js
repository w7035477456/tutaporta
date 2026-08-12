import pool from '../../db/connection.js';
import { insertNewSinglesAccount } from '../../utils/newSinglesAccount.js';
import { referCodeFromMemberId } from '../../utils/referCodeFromMemberId.js';
import { resolveReferByCodeForSignup } from '../../utils/referByCode.js';
import { referCodeFromActiveRegistrationEmail } from '../../utils/registrationReferralMeta.js';
import { checkTwilioVerificationCode, isTwilioVerifyConfigured } from '../../lib/twilioVerifySms.js';
import { isUndefinedTableError } from '../../lib/pgErrors.js';
import { formatPhoneForDuplicateCheck, respondIfDuplicatePhone } from '../../utils/duplicatePhonePolicy.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { recordAuditRegistrationChange } from '../../utils/insertAuditRegistration.js';
import { processReferralSignupReward } from '../../utils/referralSignupReward.js';
import { attachOrInsertSignupLoginLog } from '../../utils/loginLog.js';

async function cleanupVerificationRowsByEmail(emailNorm) {
  const result = await pool.query(`DELETE FROM helloworldjunktest.verifications WHERE email = $1`, [emailNorm]);
  return result.rowCount || 0;
}

export async function cleanupVerificationsByEmail(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailNorm = normalizeEmailForDb(email);
    if (!emailNorm) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const deletedCount = await cleanupVerificationRowsByEmail(emailNorm);
    return res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error in cleanupVerificationsByEmail:', error);
    return res.status(500).json({ error: 'Failed to cleanup verification rows' });
  }
}

export async function verifyPhone(req, res) {
  try {
    const { email, phone, verificationCode: verificationCodeRaw, referByCode: referByCodeRaw, ref: refRaw, token: tokenRaw } =
      req.body;
    const emailNormEarly = normalizeEmailForDb(email);
    const metaRef = emailNormEarly ? await referCodeFromActiveRegistrationEmail(pool, emailNormEarly) : '';
    const resolvedReferByCode = resolveReferByCodeForSignup({
      referByCode: referByCodeRaw,
      ref: refRaw,
      token: tokenRaw,
      metaRef
    });

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email, phone, and verification code are required' });
    }

    const verificationCode = String(verificationCodeRaw ?? '').trim().replace(/\D/g, '');
    if (!verificationCode || verificationCode.length !== 6) {
      return res.status(400).json({
        error: 'Invalid verification code',
        details: 'The verification code must be exactly 6 digits.'
      });
    }

    const formattedPhone = formatPhoneForDuplicateCheck(phone);
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }
    const emailNorm = normalizeEmailForDb(email);

    let storedRow_AAAAA;
    /** @type {'verifications' | 'pending_phone_verifications' | null} */
    let phoneSessionTable = null;
    {
      const sessionResult_AAAAA = await pool.query(
        `SELECT id, password_hash
         FROM helloworldjunktest.verifications
         WHERE email = $1
           AND phone = $2
           AND kind = 'phone_verify_session'
           AND used_at IS NULL
           AND expires_at > now()`,
        [emailNorm, formattedPhone]
      );
      storedRow_AAAAA = sessionResult_AAAAA.rows[0];
      if (storedRow_AAAAA) phoneSessionTable = 'verifications';
    }

    // Backward compatibility: legacy table (omit if schema has no pending_phone_verifications)
    if (!storedRow_AAAAA) {
      try {
        const legacyResult_AAAAA = await pool.query(
          `SELECT id, password_hash
           FROM helloworldjunktest.pending_phone_verifications
           WHERE email = $1
             AND phone = $2
             AND used_at IS NULL
             AND expires_at > now()`,
          [emailNorm, formattedPhone]
        );
        storedRow_AAAAA = legacyResult_AAAAA.rows[0];
        if (storedRow_AAAAA) phoneSessionTable = 'pending_phone_verifications';
      } catch (e) {
        if (!isUndefinedTableError(e)) throw e;
      }
    }
    if (!storedRow_AAAAA) {
      return res.status(400).json({ error: 'Verification session not found. Please start the verification process again.' });
    }

    let isCodeApproved = false;
    if (!isTwilioVerifyConfigured()) {
      console.error('❌ Twilio Verify SMS not configured');
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    } else {
      isCodeApproved = await checkTwilioVerificationCode(formattedPhone, verificationCode);
    }

    if (!isCodeApproved) {
      console.log('❌ Verification code mismatch');
      return res.status(400).json({
        error: 'Invalid verification code',
        details: 'The verification code is incorrect. Please try again.'
      });
    }

    if (await respondIfDuplicatePhone(res, formattedPhone)) return;

    if (!storedRow_AAAAA.password_hash) {
      if (phoneSessionTable === 'verifications') {
        await pool.query(
          `UPDATE helloworldjunktest.verifications SET kind = 'phone_verified_pending_password' WHERE id = $1`,
          [storedRow_AAAAA.id]
        );
      }
      console.log('✅ Phone verified via Twilio; awaiting password to complete registration.');
      return res.json({
        success: true,
        needsPassword: true,
        message: 'Phone verified. Please create your password to finish registration.'
      });
    }

    if (phoneSessionTable === 'verifications') {
      await pool.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [storedRow_AAAAA.id]);
    } else if (phoneSessionTable === 'pending_phone_verifications') {
      await pool.query(`UPDATE helloworldjunktest.pending_phone_verifications SET used_at = now() WHERE id = $1`, [storedRow_AAAAA.id]);
    }

    try {
      const passwordHash_AAAAA = storedRow_AAAAA.password_hash;
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
          [passwordHash_AAAAA, formattedPhone, emailNorm, referCodeFromMemberId(memberId), resolvedReferByCode]
        );
        await recordAuditRegistrationChange(pool, {
          singlesId: existingSinglesId,
          email: emailNorm,
          phone: formattedPhone
        });
      } else {
        const account = await insertNewSinglesAccount(pool, {
          emailNorm,
          passwordHash: passwordHash_AAAAA,
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

      try {
        await cleanupVerificationRowsByEmail(emailNorm);
      } catch (cleanupError) {
        // Cleanup should not block completed signup; log and continue.
        console.error('Failed to cleanup verification rows after phone verification:', cleanupError);
      }

      console.log('✅ Phone verified successfully. Account created.');
      return res.json({ success: true, message: 'Phone verified successfully. Account created.' });
    } catch (dbError) {
      console.error('Database error in verifyPhone:', dbError);
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  } catch (error) {
    console.error('Error in verifyPhone:', error);
    res.status(500).json({ error: 'Failed to verify phone' });
  }
}
