import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { enrichMailOptions } from '../../lib/emailHtml.js';
import { buildRegistrationEmailHtml } from '../../lib/registrationEmail.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import {
  formatPhoneForDuplicateCheck,
  findDuplicatePhoneRegistrationError,
  isDuplicatePhoneAllowed
} from '../../utils/duplicatePhonePolicy.js';
import { normalizeReferralCodeQuery } from './validateReferralCode.js';
import { isDefaultReferByCode } from '../../utils/referByCode.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { getUsSignupPhoneValidationMessage, validateUsSignupPhone } from '../../utils/usPhoneValidation.js';
import { insertSignupLoginLog } from '../../utils/loginLog.js';

const EMAIL_EXISTS_ERROR = 'This email already exist in out system. Please double check your email.';
const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRegistrationCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

/** Query string for /pages/createPassword from registration email. */
export function buildRegistrationCreatePasswordUrl({ base, email, code, phoneRaw, refRaw }) {
  const params = new URLSearchParams();
  params.set('email', String(email).trim().toLowerCase());
  params.set('code', String(code).trim().toUpperCase());

  const phoneDigits = String(phoneRaw ?? '').replace(/\D/g, '');
  if (phoneDigits.length === 10) {
    const phoneFormatted = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
    params.set('phone', phoneFormatted);
  }

  const token = normalizeReferralCodeQuery(refRaw);
  if (token) params.set('token', token);

  return `${base}/pages/createPassword?${params.toString()}`;
}

/** Manual verify path from registration email — preserves referrer token in URL. */
export function buildRegistrationVerifyEmailUrl({ base, refRaw }) {
  const token = normalizeReferralCodeQuery(refRaw);
  if (!token) return `${base}/verifyemail`;
  const params = new URLSearchParams();
  params.set('token', token);
  return `${base}/verifyemail?${params.toString()}`;
}

export async function registerUser(req, res) {
  try {
    const { email, phone: phoneRaw, ref: refRaw, referByCode: referByCodeRaw, token: tokenRaw } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailTrimmed = normalizeEmailForDb(email);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailTrimmed)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (phoneRaw != null && String(phoneRaw).trim() !== '') {
      const phoneValidationMessage = getUsSignupPhoneValidationMessage(phoneRaw);
      if (!validateUsSignupPhone(phoneRaw).valid) {
        return res.status(400).json({ error: phoneValidationMessage || 'Please enter a valid US phone number.' });
      }
    }

    let existing;
    try {
      existing = await pool.query('SELECT 1 FROM helloworldjunktest.singles WHERE email = $1', [emailTrimmed]);
    } catch (dbError) {
      console.error('DB error checking existing email:', dbError);
      return res.status(500).json({
        error: 'Failed to process registration',
        details: 'Database error while checking email. Please try again.'
      });
    }
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: EMAIL_EXISTS_ERROR });
    }

    const formattedPhoneForCheck = formatPhoneForDuplicateCheck(phoneRaw);
    if (formattedPhoneForCheck) {
      if (isDuplicatePhoneAllowed()) {
        console.log('[register] DUPLICATE_PHONE_ALLOW=true: skipping duplicate phone check');
      } else {
        const duplicatePhoneError = await findDuplicatePhoneRegistrationError(formattedPhoneForCheck);
        if (duplicatePhoneError) {
          return res.status(409).json({ error: duplicatePhoneError });
        }
      }
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const isSmtpConfigured =
      smtpUser &&
      smtpPass &&
      smtpUser !== 'your-email@gmail.com' &&
      smtpPass !== 'your-app-password';

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;
    const maskPass = (p) => (p && p.length >= 4 ? `${p.slice(0, 2)}****${p.slice(-2)}` : '(not set or too short)');
    console.log(
      '[SMTP] Using: SMTP_HOST=' +
        smtpHost +
        ' SMTP_PORT=' +
        smtpPortNum +
        ' SMTP_USER=' +
        (smtpUser || '(not set)') +
        ' SMTP_PASS=' +
        maskPass(smtpPass)
    );
    const code = generateRegistrationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
    const phoneDigits = String(phoneRaw ?? '').replace(/\D/g, '');
    const refCodeRaw = normalizeReferralCodeQuery(refRaw ?? referByCodeRaw ?? tokenRaw);
    const refCode = refCodeRaw && !isDefaultReferByCode(refCodeRaw) ? refCodeRaw : '';
    const registrationMeta = {};
    if (phoneDigits.length === 10) {
      registrationMeta.phone_digits = phoneDigits;
    }
    if (refCode) {
      registrationMeta.ref = refCode;
    }
    const registrationMetaJson = Object.keys(registrationMeta).length ? JSON.stringify(registrationMeta) : null;

    try {
      await pool.query(
        `DELETE FROM helloworldjunktest.verifications
         WHERE email = $1 AND kind = 'registration_email' AND used_at IS NULL`,
        [emailTrimmed]
      );
      await pool.query(
        `INSERT INTO helloworldjunktest.verifications (email, code, password_hash, kind, expires_at)
         VALUES ($1, $2, $3, 'registration_email', $4)`,
        [emailTrimmed, code, registrationMetaJson, expiresAt]
      );
    } catch (dbErr) {
      console.error('[register] DB error saving verification:', dbErr);
      return res.status(500).json({
        error: 'Failed to process registration',
        details: 'Database error while saving registration code. Please try again.'
      });
    }

    if (isSmtpConfigured) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPortNum,
          secure: false,
          auth: { user: smtpUser, pass: smtpPass }
        });

        const base = getPublicAppUrl();
        const createPasswordUrl = buildRegistrationCreatePasswordUrl({
          base,
          email: emailTrimmed,
          code,
          phoneRaw,
          refRaw: refCode
        });
        const verifyEmailUrl = buildRegistrationVerifyEmailUrl({ base, refRaw: refCode });

        await transporter.sendMail(
          enrichMailOptions({
            from: OUTBOUND_EMAIL_FROM_HEADER,
            to: emailTrimmed,
            subject: 'Complete Your Registration - Create Password',
            html: buildRegistrationEmailHtml({ code, createPasswordUrl, verifyEmailUrl })
          })
        );
        console.log('Registration email sent to:', emailTrimmed, '(code in link)');
      } catch (emailError) {
        console.error('Error in registration email step:', emailError);
        let errorDetails = '';
        if (emailError.code === 'EAUTH' || (emailError.message && emailError.message.includes('Application-specific password required'))) {
          errorDetails =
            'Gmail requires an App Password when 2FA is enabled. Go to: Google Account → Security → 2-Step Verification → App passwords. Generate an app password for "Mail" and use it as SMTP_PASS in ~/.ssh/be/.env.';
        } else if (emailError.message) {
          errorDetails = emailError.message;
        }
        return res.status(500).json({
          error: 'Failed to send registration email',
          details: errorDetails || (emailError.message || '') || 'Please check your SMTP configuration and try again.'
        });
      }
    } else {
      const detailsMsg =
        'SMTP_USER and SMTP_PASS must be set in ~/.ssh/be/.env (and not placeholders). For Gmail use an App Password.';
      console.error('SMTP not configured. Cannot send registration email.', detailsMsg);
      return res.status(500).json({
        error: 'Email service not configured. Cannot send registration email.',
        details: detailsMsg
      });
    }

    const phoneForLog = formattedPhoneForCheck || String(phoneRaw ?? '').trim();
    if (phoneForLog) {
      await insertSignupLoginLog(req, {
        email: emailTrimmed,
        phone: phoneForLog
      });
    }

    res.json({ success: true, message: 'Registration email sent successfully' });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({
      error: 'Failed to process registration',
      details: error.message || 'An unexpected error occurred.'
    });
  }
}
