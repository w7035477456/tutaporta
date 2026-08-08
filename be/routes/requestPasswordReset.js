import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../lib/emailHtml.js';
import { normalizeEmailForDb } from '../utils/normalizeEmailForDb.js';

const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

function getPublicAppUrl() {
  const override = process.env.PUBLIC_APP_URL || process.env.FRONTEND_PUBLIC_URL;
  if (override && String(override).trim()) {
    return String(override).trim().replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://OnlineMall.Website';
  }
  return 'http://localhost:3000';
}

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for this email, you will receive password reset instructions shortly.';

/**
 * POST /api/requestPasswordReset — body: { email }
 * If email is registered, stores a code and sends reset link (same response text either way).
 */
export async function requestPasswordReset(req, res) {
  try {
    const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!emailRaw) {
      return res.status(400).json({ error: 'Email required' });
    }

    const emailNorm = normalizeEmailForDb(emailRaw);

    const userResult = await pool.query('SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1', [emailNorm]);
    if (userResult.rows.length === 0) {
      return res.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
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

    if (!isSmtpConfigured) {
      console.error('[requestPasswordReset] SMTP not configured; cannot send reset email.');
      return res.status(500).json({
        error: 'Email service not configured.',
        details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    try {
      await pool.query(
        `DELETE FROM helloworldjunktest.verifications
         WHERE email = $1 AND kind = 'password_reset' AND used_at IS NULL`,
        [emailNorm]
      );
      await pool.query(
        `INSERT INTO helloworldjunktest.verifications (email, code, kind, expires_at)
         VALUES ($1, $2, 'password_reset', $3)`,
        [emailNorm, code, expiresAt]
      );
    } catch (dbErr) {
      console.error('[requestPasswordReset] DB error:', dbErr);
      return res.status(500).json({ error: 'Failed to process password reset request.' });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPortNum,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });

      const base = getPublicAppUrl();
      const resetUrl = `${base}/pages/resetPassword?email=${encodeURIComponent(emailNorm)}&code=${encodeURIComponent(code)}`;

      await transporter.sendMail(
        enrichMailOptions({
          from: OUTBOUND_EMAIL_FROM_HEADER,
          to: emailNorm,
          subject: 'Reset Your Password - OnlineMall.Website',
          html: wrapEmailHtml(`
            <h2 style="color: #333;">Password reset</h2>
            <p>We received a request to reset your password. Use the code below and click the button, or open the link.</p>
            <p style="margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Reset password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not request this, you can ignore this email.</p>
          `)
        })
      );
      console.log('[requestPasswordReset] email sent to:', emailNorm);
    } catch (emailError) {
      console.error('[requestPasswordReset] sendMail error:', emailError);
      let errorDetails = '';
      if (
        emailError.code === 'EAUTH' ||
        (emailError.message && emailError.message.includes('Application-specific password required'))
      ) {
        errorDetails =
          'Gmail may require an App Password when 2FA is enabled. Check SMTP_PASS in server env.';
      } else if (emailError.message) {
        errorDetails = emailError.message;
      }
      return res.status(500).json({
        error: 'Failed to send password reset email.',
        details: errorDetails || emailError.message || ''
      });
    }

    return res.json({ success: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    console.error('[requestPasswordReset]', error);
    return res.status(500).json({ error: 'Failed to process request.' });
  }
}
