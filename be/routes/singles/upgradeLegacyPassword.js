import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { getPrivateKey } from '../../jwtKeys.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../../lib/emailHtml.js';
import { getAuthJwtExpiresInSeconds, setAuthCookie } from '../../utils/authCookie.js';
import { startSingleLoginSession } from '../../utils/singleLoginSession.js';
import { resolveCustomLogoutMinutes } from '../../utils/customLogoutDuration.js';
import { PASSWORD_ATTEMPT_EPOCH } from '../../utils/passwordAttemptTracking.js';
import { hashPassword } from '../../utils/passwordHash.js';
import { validateNewPasswordRequirements } from '../../utils/passwordRequirements.js';

const LOG_PREFIX = '[upgradeLegacyPassword]';

function isSmtpConfigured() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return Boolean(
    smtpUser &&
      smtpPass &&
      smtpUser !== 'your-email@gmail.com' &&
      smtpPass !== 'your-app-password'
  );
}

function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPortNum,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

async function sendPasswordUpgradeNotificationEmail(emailNorm) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping password upgrade notification email`);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail(
    enrichMailOptions({
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: emailNorm,
      subject: 'Your password was updated - OnlineMall.Website',
      html: wrapEmailHtml(`
        <h2 style="color: #333;">Password updated</h2>
        <p>Your OnlineMall.Website account password was changed because you signed in with a temporary 6-digit password.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p style="margin-top: 30px; color: #999; font-size: 12px;">This is an automated security notification.</p>
      `)
    })
  );
}

/**
 * POST /api/upgradeLegacyPassword — body: { newPassword, confirmPassword }
 * Requires auth JWT with requiresPasswordUpgrade claim (legacy 6-digit login).
 */
export async function upgradeLegacyPassword(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.auth?.requiresPasswordUpgrade) {
    return res.status(403).json({ error: 'Password upgrade is not required for this session.' });
  }

  const plainNew = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const plainConfirm = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!plainNew || !plainConfirm) {
    return res.status(400).json({ error: 'New password and confirmation are required.' });
  }
  if (plainNew !== plainConfirm) {
    return res.status(400).json({ error: 'New password entries do not match.' });
  }

  const validation = validateNewPasswordRequirements(plainNew);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT singles_id, email
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       FOR UPDATE`,
      [singlesId]
    );
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const emailNorm = String(userResult.rows[0].email ?? req.auth?.email ?? '')
      .trim()
      .toLowerCase();
    const passwordHash = await hashPassword(plainNew);

    await client.query(
      `UPDATE helloworldjunktest.singles
       SET password_hash = $1,
           password_attempt_count = 1,
           password_attempt_datetime = $3::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [passwordHash, singlesId, PASSWORD_ATTEMPT_EPOCH]
    );

    await client.query('COMMIT');

    if (emailNorm) {
      try {
        await sendPasswordUpgradeNotificationEmail(emailNorm);
      } catch (emailErr) {
        console.error(`${LOG_PREFIX} notification email failed`, emailErr?.message ?? emailErr);
      }
    }

    const logoutMins = await resolveCustomLogoutMinutes(singlesId);
    const sessionId = await startSingleLoginSession(singlesId, logoutMins);
    const token = jwt.sign(
      {
        singles_id: singlesId,
        email: emailNorm || req.auth?.email || null,
        custom_logout_duration: logoutMins,
        ...(sessionId ? { session_id: sessionId } : {})
      },
      getPrivateKey(),
      {
        algorithm: 'RS256',
        expiresIn: getAuthJwtExpiresInSeconds({ rememberMe: false })
      }
    );
    setAuthCookie(res, token, { rememberMe: false });

    console.log(LOG_PREFIX, 'password upgraded', { singles_id: singlesId });
    return res.json({
      success: true,
      requiresPasswordUpgrade: false,
      message: 'Your new password has been saved.'
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error(LOG_PREFIX, err?.message ?? err);
    return res.status(500).json({ error: 'Failed to save new password.' });
  } finally {
    client.release();
  }
}
