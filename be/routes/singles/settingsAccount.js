import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import {
  checkTwilioVerificationCode,
  isTwilioVerifyConfigured,
  sendTwilioVerificationSms
} from '../../lib/twilioVerifySms.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { wrapEmailHtml } from '../../lib/emailHtml.js';
import { sendOutboundMail } from '../../lib/outboundMail.js';
import {
  PASSWORD_ATTEMPT_EPOCH,
  verifyCurrentPasswordWithAttemptTracking
} from '../../utils/passwordAttemptTracking.js';
import { hashPassword } from '../../utils/passwordHash.js';
import { assertAccountChangeAllowed } from '../../utils/accountChangeCooldown.js';
import { DUPLICATE_PHONE_ERROR, isDuplicatePhoneAllowed } from '../../utils/duplicatePhonePolicy.js';
import { hashSecretIconName, normalizeSecretIconName } from '../../utils/secretIconHash.js';
import { verifySecretIconWithAttemptTracking } from '../../utils/secretIconAttemptTracking.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { recordAuditRegistrationChange } from '../../utils/insertAuditRegistration.js';
import { invalidateAuthUserCache } from '../../utils/authUserLookupCache.js';

const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const EMAIL_CHANGE_KIND = 'email_change';
const SETTINGS_PASSWORD_CHANGE_SESSION_KIND = 'settings_password_change_session';
const SETTINGS_PASSWORD_CHANGE_VERIFIED_KIND = 'settings_password_change_verified';
const SETTINGS_EMAIL_CHANGE_SESSION_KIND = 'settings_email_change_session';
const SETTINGS_EMAIL_CHANGE_VERIFIED_KIND = 'settings_email_change_verified';
const SETTINGS_EMAIL_CHANGE_PENDING_KIND = 'settings_email_change_pending';
const SETTINGS_PHONE_CHANGE_PENDING_KIND = 'settings_phone_change_pending';
const SETTINGS_PHONE_CHANGE_EMAIL_VERIFIED_KIND = 'settings_phone_change_email_verified';
const SETTINGS_PHONE_CHANGE_SMS_SESSION_KIND = 'settings_phone_change_sms_session';
const SETTINGS_ACCOUNT_SMS_SESSION_MS = 15 * 60 * 1000;

function generateNumericCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

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

function isValidEmail(raw) {
  const email = normalizeEmailForDb(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhoneDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function isValidPhone(raw) {
  return normalizePhoneDigits(raw).length === 10;
}

function formatPhoneForStorage(raw) {
  const digits = normalizePhoneDigits(raw);
  if (digits.length !== 10) return null;
  return `+1${digits}`;
}

/** US display format for emails: (703) 547-7456 */
function formatPhoneForDisplay(stored) {
  const digits = normalizePhoneDigits(stored);
  if (digits.length !== 10) return String(stored ?? '').trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** History text[] item: value|ISO8601 (see addSinglesOldEmailArray.sql / addSinglesOldPhoneArray.sql). */
function buildHistoryArrayEntry(value, changedAt = new Date()) {
  return `${String(value ?? '').trim()}|${changedAt.toISOString()}`;
}

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

function parseEmailChangeMeta(passwordHashField) {
  try {
    const parsed = JSON.parse(String(passwordHashField ?? ''));
    const singlesId = Number(parsed?.singles_id);
    const oldEmail = String(parsed?.old_email ?? '').trim().toLowerCase();
    if (!Number.isFinite(singlesId) || singlesId < 1 || !oldEmail) return null;
    return { singles_id: singlesId, old_email: oldEmail };
  } catch {
    return null;
  }
}

function parseSettingsEmailChangePendingMeta(passwordHashField) {
  try {
    const parsed = JSON.parse(String(passwordHashField ?? ''));
    const singlesId = Number(parsed?.singles_id);
    const oldEmail = String(parsed?.old_email ?? '').trim().toLowerCase();
    const newEmail = String(parsed?.new_email ?? '').trim().toLowerCase();
    if (!Number.isFinite(singlesId) || singlesId < 1 || !oldEmail || !newEmail) return null;
    return { singles_id: singlesId, old_email: oldEmail, new_email: newEmail };
  } catch {
    return null;
  }
}

async function clearSettingsEmailChangePendingForSingles(singlesId, client = pool) {
  const pending = await client.query(
    `SELECT id, password_hash
     FROM helloworldjunktest.verifications
     WHERE kind = $1
       AND used_at IS NULL`,
    [SETTINGS_EMAIL_CHANGE_PENDING_KIND]
  );
  for (const row of pending.rows) {
    const meta = parseSettingsEmailChangePendingMeta(row.password_hash);
    if (meta?.singles_id === singlesId) {
      await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
    }
  }
}

/**
 * POST /api/settings/changePassword — body: { currentPassword, newPassword, confirmPassword }
 *
 * Attempt limits use singles.password_attempt_count and singles.password_attempt_datetime
 * in PostgreSQL only (no in-memory store). Row is locked with FOR UPDATE so round-robin
 * multi-server deployments share one counter per member.
 */
export async function changeSettingsPassword(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  const confirmPassword = req.body?.confirmPassword;
  const plainNew = typeof newPassword === 'string' ? newPassword : '';
  const plainConfirm = typeof confirmPassword === 'string' ? confirmPassword : '';
  const plainCurrent = typeof currentPassword === 'string' ? currentPassword.trim() : '';

  if (!plainCurrent) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!plainNew || !plainConfirm) {
    return res.status(400).json({ error: 'New password and confirmation are required.' });
  }
  if (plainNew !== plainConfirm) {
    return res.status(400).json({ error: 'New password entries do not match.' });
  }
  if (plainNew.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gate = await verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent);
    if (!gate.ok) {
      if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return res.status(gate.response.statusCode).json(gate.response.body);
    }

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
    return res.json({ success: true, message: 'New Password Change Success' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[settingsAccount:changePassword]', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changeEmail — body: { currentPassword, newEmail, confirmEmail }
 * Verifies current password with the same DB attempt counter as change-password, then updates email.
 */
export async function changeSettingsEmail(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const plainCurrent = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
  const newEmailRaw = String(req.body?.newEmail ?? '').trim();
  const confirmEmailRaw = String(req.body?.confirmEmail ?? '').trim();
  const newEmailNorm = newEmailRaw.toLowerCase();
  const confirmEmailNorm = confirmEmailRaw.toLowerCase();

  if (!plainCurrent) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newEmailRaw || !confirmEmailRaw) {
    return res.status(400).json({ error: 'New email and confirmation are required.' });
  }
  if (!isValidEmail(newEmailNorm) || !isValidEmail(confirmEmailNorm)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (newEmailNorm !== confirmEmailNorm) {
    return res.status(400).json({ error: 'New email entries do not match.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const gate = await verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent);
    if (!gate.ok) {
      if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return res.status(gate.response.statusCode).json(gate.response.body);
    }

    const currentEmail = String(gate.row.email ?? '').trim().toLowerCase();
    if (currentEmail && newEmailNorm === currentEmail) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That is already your current email address.' });
    }

    const taken = await client.query(
      `SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1 AND singles_id <> $2 LIMIT 1`,
      [newEmailNorm, singlesId]
    );
    if (taken.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That email address is already in use.' });
    }

    await client.query(
      `UPDATE helloworldjunktest.singles
       SET email = $1,
           password_attempt_count = 1,
           password_attempt_datetime = $3::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [newEmailNorm, singlesId, PASSWORD_ATTEMPT_EPOCH]
    );
    await recordAuditRegistrationChange(client, {
      singlesId,
      email: newEmailNorm,
      phone: String(gate.row.phone ?? '').trim()
    });
    await client.query('COMMIT');
    return res.json({ success: true, message: 'New Email updated successfully.', email: newEmailNorm });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[settingsAccount:changeEmail]', err);
    return res.status(500).json({ error: 'Failed to change email.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changePhone — body: { currentPassword, newPhone, confirmPhone }
 * Verifies current password with the same DB attempt counter as change-password, then updates phone.
 */
export async function changeSettingsPhone(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const plainCurrent = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
  const newPhoneRaw = String(req.body?.newPhone ?? '').trim();
  const confirmPhoneRaw = String(req.body?.confirmPhone ?? '').trim();
  const newPhoneDigits = normalizePhoneDigits(newPhoneRaw);
  const confirmPhoneDigits = normalizePhoneDigits(confirmPhoneRaw);

  if (!plainCurrent) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newPhoneRaw || !confirmPhoneRaw) {
    return res.status(400).json({ error: 'New phone and confirmation are required.' });
  }
  if (!isValidPhone(newPhoneRaw) || !isValidPhone(confirmPhoneRaw)) {
    return res.status(400).json({ error: 'A valid 10-digit phone number is required.' });
  }
  if (newPhoneDigits !== confirmPhoneDigits) {
    return res.status(400).json({ error: 'New phone entries do not match.' });
  }

  const newPhoneStored = formatPhoneForStorage(newPhoneRaw);
  if (!newPhoneStored) {
    return res.status(400).json({ error: 'A valid 10-digit phone number is required.' });
  }

  const client = await pool.connect();
  try {
    const cooldown = await assertAccountChangeAllowed(client, singlesId, 'phone');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    await client.query('BEGIN');

    const gate = await verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent);
    if (!gate.ok) {
      if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      return res.status(gate.response.statusCode).json(gate.response.body);
    }

    const currentPhoneStored = formatPhoneForStorage(gate.row.phone) || String(gate.row.phone ?? '').trim();
    if (currentPhoneStored && newPhoneStored === currentPhoneStored) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That is already your current phone number.' });
    }

    await client.query(
      `UPDATE helloworldjunktest.singles
       SET phone = $1,
           last_phone_change_date = CURRENT_DATE,
           password_attempt_count = 1,
           password_attempt_datetime = $3::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [newPhoneStored, singlesId, PASSWORD_ATTEMPT_EPOCH]
    );
    await recordAuditRegistrationChange(client, {
      singlesId,
      email: String(gate.row.email ?? '').trim(),
      phone: newPhoneStored
    });
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Phone number updated successfully.', phone: newPhoneStored });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[settingsAccount:changePhone]', err);
    return res.status(500).json({ error: 'Failed to change phone.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/requestEmailChange — body: { newEmail }
 */
export async function requestSettingsEmailChange(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const newEmailRaw = String(req.body?.newEmail ?? '').trim();
  if (!isValidEmail(newEmailRaw)) {
    return res.status(400).json({ error: 'A valid new email address is required.' });
  }
  const newEmailNorm = newEmailRaw.toLowerCase();

  const client = await pool.connect();
  try {
    const userResult = await client.query(
      `SELECT singles_id, email FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const oldEmail = String(userResult.rows[0].email ?? '').trim().toLowerCase();
    if (!oldEmail) {
      return res.status(400).json({ error: 'Your account has no email on file.' });
    }
    if (newEmailNorm === oldEmail) {
      return res.status(400).json({ error: 'That is already your current email address.' });
    }

    const taken = await client.query(`SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1 LIMIT 1`, [newEmailNorm]);
    if (taken.rows.length > 0) {
      return res.status(400).json({ error: 'That email address is already in use.' });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({
        error: 'Email service not configured.',
        details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
      });
    }

    const pending = await client.query(
      `SELECT id, password_hash FROM helloworldjunktest.verifications
       WHERE kind = $1 AND used_at IS NULL AND expires_at > now()`,
      [EMAIL_CHANGE_KIND]
    );
    for (const row of pending.rows) {
      const meta = parseEmailChangeMeta(row.password_hash);
      if (meta?.singles_id === singlesId) {
        await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
    const metaJson = JSON.stringify({ singles_id: singlesId, old_email: oldEmail });

    await client.query(
      `INSERT INTO helloworldjunktest.verifications (email, code, password_hash, kind, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [newEmailNorm, code, metaJson, EMAIL_CHANGE_KIND, expiresAt]
    );

    const confirmUrl = `${getPublicAppUrl()}/pages/confirmEmailChange?email=${encodeURIComponent(newEmailNorm)}&code=${encodeURIComponent(code)}`;
    const transporter = createTransporter();

    await sendOutboundMail(transporter, {
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: newEmailNorm,
      cc: oldEmail,
      subject: 'Confirm your new email - OnlineMall.Website',
      html: wrapEmailHtml(`
          <h2 style="color: #333;">Confirm your new email</h2>
          <p>We received a request to change the email on your OnlineMall.Website account to <strong>${newEmailNorm}</strong>.</p>
          <p style="margin: 20px 0;">
            <a href="${confirmUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px;">Click this link to confirm new email</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${confirmUrl}</p>
          <p style="margin-top: 20px; font-size: 14px;">Your confirmation code: <strong>${code}</strong></p>
          <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not request this change, you can ignore this email. Your current email remains unchanged.</p>
        `)
    });

    return res.json({
      success: true,
      message: `A confirmation email was sent to ${newEmailNorm}. A copy was sent to your current email (${oldEmail}).`
    });
  } catch (err) {
    console.error('[settingsAccount:requestEmailChange]', err);
    return res.status(500).json({ error: 'Failed to send confirmation email.', details: err?.message || '' });
  } finally {
    client.release();
  }
}

/**
 * GET /api/verifyEmailChangeLink?email=&code=
 */
export async function verifyEmailChangeLink(req, res) {
  try {
    const emailNorm = String(req.query.email ?? '').trim().toLowerCase();
    const code = String(req.query.code ?? '').trim().toUpperCase();
    if (!isValidEmail(emailNorm) || !code) {
      return res.status(200).json({ valid: false, error: 'email and code query parameters are required' });
    }

    const result = await pool.query(
      `SELECT id, email, password_hash
       FROM helloworldjunktest.verifications
       WHERE code = $1
         AND kind = $2
         AND used_at IS NULL
         AND expires_at > now()`,
      [code, EMAIL_CHANGE_KIND]
    );
    const row = result.rows[0];
    if (!row || normalizeEmailForDb(row.email) !== emailNorm) {
      return res.status(200).json({ valid: false });
    }
    if (!parseEmailChangeMeta(row.password_hash)) {
      return res.status(200).json({ valid: false });
    }
    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error('[settingsAccount:verifyEmailChangeLink]', err);
    return res.status(500).json({ valid: false, error: 'Failed to verify link' });
  }
}

/**
 * POST /api/completeEmailChange — body: { email, code }
 */
export async function completeEmailChange(req, res) {
  try {
    const emailNorm = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    if (!isValidEmail(emailNorm) || !code) {
      return res.status(400).json({ error: 'Email and confirmation code are required.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT id, email, password_hash
         FROM helloworldjunktest.verifications
         WHERE code = $1
           AND kind = $2
           AND used_at IS NULL
           AND expires_at > now()
         FOR UPDATE`,
        [code, EMAIL_CHANGE_KIND]
      );
      const row = result.rows[0];
      if (!row || normalizeEmailForDb(row.email) !== emailNorm) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'This confirmation link is invalid, expired, or already used. Please request a new email change.'
        });
      }

      const meta = parseEmailChangeMeta(row.password_hash);
      if (!meta) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid email change request.' });
      }

      const taken = await client.query(`SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1 LIMIT 1`, [emailNorm]);
      if (taken.rows.length > 0 && Number(taken.rows[0].singles_id) !== meta.singles_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'That email address is already in use.' });
      }

      const contactResult = await client.query(
        `SELECT phone FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
        [meta.singles_id]
      );
      const currentPhone = String(contactResult.rows[0]?.phone ?? '').trim();

      await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
      await client.query(
        `UPDATE helloworldjunktest.singles SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [emailNorm, meta.singles_id]
      );
      await recordAuditRegistrationChange(client, {
        singlesId: meta.singles_id,
        email: emailNorm,
        phone: currentPhone
      });
      await client.query('COMMIT');
      await invalidateAuthUserCache(meta.singles_id);
      return res.json({ success: true, message: 'Your email address has been updated. Please sign in with your new email.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[settingsAccount:completeEmailChange]', err);
    return res.status(500).json({ error: 'Failed to confirm email change.' });
  }
}

async function loadSinglesContactForSettings(singlesId) {
  const { rows } = await pool.query(
    `SELECT singles_id, email, phone
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return rows[0] || null;
}

async function clearSettingsAccountSmsSessions(emailNorm, formattedPhone, sessionKind, verifiedKind) {
  await pool.query(
    `DELETE FROM helloworldjunktest.verifications
     WHERE email = $1
       AND phone = $2
       AND kind IN ('${sessionKind}', '${verifiedKind}')
       AND used_at IS NULL`,
    [emailNorm, formattedPhone]
  );
}

/**
 * POST /api/settings/changePassword/sendSms — auth required; Twilio SMS to member phone on file.
 */
export async function sendSettingsChangePasswordSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const cooldown = await assertAccountChangeAllowed(pool, singlesId, 'password');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const emailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!emailNorm) {
      return res.status(400).json({ error: 'No email on file for this account.' });
    }
    if (!formattedPhone) {
      return res.status(400).json({ error: 'No valid phone number on file. Update your phone first.' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const expiresAt = new Date(Date.now() + SETTINGS_ACCOUNT_SMS_SESSION_MS);
    await clearSettingsAccountSmsSessions(
      emailNorm,
      formattedPhone,
      SETTINGS_PASSWORD_CHANGE_SESSION_KIND,
      SETTINGS_PASSWORD_CHANGE_VERIFIED_KIND
    );
    await pool.query(
      `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
       VALUES ($1, $2, NULL, $3, $4)`,
      [emailNorm, formattedPhone, SETTINGS_PASSWORD_CHANGE_SESSION_KIND, expiresAt]
    );
    await sendTwilioVerificationSms(formattedPhone);

    return res.json({
      success: true,
      message: 'Verification code sent to your phone',
      phone: formattedPhone
    });
  } catch (err) {
    console.error('[settingsAccount:sendChangePasswordSms]', err);
    return res.status(500).json({ error: 'Failed to send verification SMS.' });
  }
}

/**
 * POST /api/settings/changePassword/verifySms — body: { verificationCode }
 */
export async function verifySettingsChangePasswordSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const verificationCode = String(req.body?.verificationCode ?? '').trim().replace(/\D/g, '');
  if (!verificationCode || verificationCode.length !== 6) {
    return res.status(400).json({
      error: 'Invalid verification code',
      details: 'The verification code must be exactly 6 digits.'
    });
  }

  try {
    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const emailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!emailNorm || !formattedPhone) {
      return res.status(400).json({ error: 'Phone verification is not available for this account.' });
    }

    const sessionResult = await pool.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = $3
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailNorm, formattedPhone, SETTINGS_PASSWORD_CHANGE_SESSION_KIND]
    );
    if (!sessionResult.rows[0]) {
      return res.status(400).json({
        error: 'Verification session not found. Please press Send SMS Code again.'
      });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const approved = await checkTwilioVerificationCode(formattedPhone, verificationCode);
    if (!approved) {
      return res.status(400).json({
        error: 'Invalid verification code',
        details: 'The verification code is incorrect. Please try again.'
      });
    }

    await pool.query(
      `UPDATE helloworldjunktest.verifications
       SET kind = $1
       WHERE id = $2`,
      [SETTINGS_PASSWORD_CHANGE_VERIFIED_KIND, sessionResult.rows[0].id]
    );

    return res.json({ success: true, verified: true, message: 'Verify SMS Code PASSES' });
  } catch (err) {
    console.error('[settingsAccount:verifyChangePasswordSms]', err);
    return res.status(500).json({ error: 'Failed to verify SMS code.' });
  }
}

/**
 * POST /api/settings/changePassword/complete — body: { newPassword, confirmPassword }
 */
export async function completeSettingsChangePassword(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const plainNew = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const plainConfirm = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!plainNew || !plainConfirm) {
    return res.status(400).json({ error: 'New password and confirmation are required.' });
  }
  if (plainNew !== plainConfirm) {
    return res.status(400).json({ error: 'New password entries do not match.' });
  }
  if (plainNew.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  if (!/[a-z]/.test(plainNew) || !/[A-Z]/.test(plainNew) || !(/[0-9]/.test(plainNew) || /[^a-zA-Z0-9]/.test(plainNew))) {
    return res.status(400).json({ error: 'Please meet all password requirements.' });
  }

  const client = await pool.connect();
  try {
    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const emailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!emailNorm || !formattedPhone) {
      return res.status(400).json({ error: 'Phone verification is not available for this account.' });
    }

    const cooldown = await assertAccountChangeAllowed(client, singlesId, 'password');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    await client.query('BEGIN');

    const verified = await client.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = $3
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [emailNorm, formattedPhone, SETTINGS_PASSWORD_CHANGE_VERIFIED_KIND]
    );
    if (!verified.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Please verify your phone with SMS before creating a new password.' });
    }

    const passwordHash = await hashPassword(plainNew);
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET password_hash = $1,
           last_password_change_date = CURRENT_DATE,
           password_attempt_count = 1,
           password_attempt_datetime = $3::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [passwordHash, singlesId, PASSWORD_ATTEMPT_EPOCH]
    );
    await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [
      verified.rows[0].id
    ]);
    await client.query('COMMIT');

    return res.json({ success: true, message: 'Changes successful' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:completeChangePassword]', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changeEmail/sendSms — auth required; Twilio SMS to member phone on file.
 */
export async function sendSettingsChangeEmailSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const cooldown = await assertAccountChangeAllowed(pool, singlesId, 'email');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const emailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!emailNorm) {
      return res.status(400).json({ error: 'No email on file for this account.' });
    }
    if (!formattedPhone) {
      return res.status(400).json({ error: 'No valid phone number on file. Update your phone first.' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const expiresAt = new Date(Date.now() + SETTINGS_ACCOUNT_SMS_SESSION_MS);
    await clearSettingsAccountSmsSessions(
      emailNorm,
      formattedPhone,
      SETTINGS_EMAIL_CHANGE_SESSION_KIND,
      SETTINGS_EMAIL_CHANGE_VERIFIED_KIND
    );
    await pool.query(
      `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
       VALUES ($1, $2, NULL, $3, $4)`,
      [emailNorm, formattedPhone, SETTINGS_EMAIL_CHANGE_SESSION_KIND, expiresAt]
    );
    await sendTwilioVerificationSms(formattedPhone);

    return res.json({
      success: true,
      message: 'Verification code sent to your phone',
      phone: formattedPhone
    });
  } catch (err) {
    console.error('[settingsAccount:sendChangeEmailSms]', err);
    return res.status(500).json({ error: 'Failed to send verification SMS.' });
  }
}

/**
 * POST /api/settings/changeEmail/verifySms — body: { verificationCode }
 */
export async function verifySettingsChangeEmailSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const verificationCode = String(req.body?.verificationCode ?? '').trim().replace(/\D/g, '');
  if (!verificationCode || verificationCode.length !== 6) {
    return res.status(400).json({
      error: 'Invalid verification code',
      details: 'The verification code must be exactly 6 digits.'
    });
  }

  try {
    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const emailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!emailNorm || !formattedPhone) {
      return res.status(400).json({ error: 'Phone verification is not available for this account.' });
    }

    const sessionResult = await pool.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = $3
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [emailNorm, formattedPhone, SETTINGS_EMAIL_CHANGE_SESSION_KIND]
    );
    if (!sessionResult.rows[0]) {
      return res.status(400).json({
        error: 'Verification session not found. Please press Send SMS Code again.'
      });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const approved = await checkTwilioVerificationCode(formattedPhone, verificationCode);
    if (!approved) {
      return res.status(400).json({
        error: 'SMS code incorrect. Please retry.',
        details: 'SMS code incorrect. Please retry.'
      });
    }

    await pool.query(
      `UPDATE helloworldjunktest.verifications
       SET kind = $1
       WHERE id = $2`,
      [SETTINGS_EMAIL_CHANGE_VERIFIED_KIND, sessionResult.rows[0].id]
    );

    return res.json({ success: true, verified: true, message: 'Verify SMS Code PASSES' });
  } catch (err) {
    console.error('[settingsAccount:verifyChangeEmailSms]', err);
    return res.status(500).json({ error: 'Failed to verify SMS code.' });
  }
}

/**
 * POST /api/settings/changeEmail/submit — body: { currentPassword, newEmail, confirmEmail }
 * After SMS verify: checks current password, sends 6-digit code to the new email address.
 */
export async function submitSettingsChangeEmail(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const plainCurrent = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
  const newEmailRaw = String(req.body?.newEmail ?? '').trim();
  const confirmEmailRaw = String(req.body?.confirmEmail ?? '').trim();
  const newEmailNorm = newEmailRaw.toLowerCase();
  const confirmEmailNorm = confirmEmailRaw.toLowerCase();

  if (!plainCurrent) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newEmailRaw || !confirmEmailRaw) {
    return res.status(400).json({ error: 'New email and confirmation are required.' });
  }
  if (!isValidEmail(newEmailNorm) || !isValidEmail(confirmEmailNorm)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (newEmailNorm !== confirmEmailNorm) {
    return res.status(400).json({ error: 'New email entries do not match.' });
  }

  if (!isSmtpConfigured()) {
    return res.status(500).json({
      error: 'Email service not configured.',
      details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
    });
  }

  const client = await pool.connect();
  try {
    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const currentEmailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!currentEmailNorm || !formattedPhone) {
      return res.status(400).json({ error: 'Phone verification is not available for this account.' });
    }

    if (newEmailNorm === currentEmailNorm) {
      return res.status(400).json({ error: 'That is already your current email address.' });
    }

    await client.query('BEGIN');

    const smsVerified = await client.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = $3
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [currentEmailNorm, formattedPhone, SETTINGS_EMAIL_CHANGE_VERIFIED_KIND]
    );
    if (!smsVerified.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Please verify your phone with SMS before changing email.' });
    }

    const gate = await verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent);
    if (!gate.ok) {
      if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      // Use 403 for wrong password so FE does not confuse it with missing login session (401).
      const statusCode = gate.response.statusCode === 401 ? 403 : gate.response.statusCode;
      return res.status(statusCode).json(gate.response.body);
    }

    const taken = await client.query(
      `SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1 AND singles_id <> $2 LIMIT 1`,
      [newEmailNorm, singlesId]
    );
    if (taken.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That email address is already in use.' });
    }

    await clearSettingsEmailChangePendingForSingles(singlesId, client);

    const code = generateNumericCode();
    const expiresAt = new Date(Date.now() + SETTINGS_ACCOUNT_SMS_SESSION_MS);
    const metaJson = JSON.stringify({
      singles_id: singlesId,
      old_email: currentEmailNorm,
      new_email: newEmailNorm
    });

    await client.query(
      `INSERT INTO helloworldjunktest.verifications (email, code, password_hash, kind, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [newEmailNorm, code, metaJson, SETTINGS_EMAIL_CHANGE_PENDING_KIND, expiresAt]
    );

    const transporter = createTransporter();
    await sendOutboundMail(transporter, {
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: newEmailNorm,
      subject: 'Your email change verification code - OnlineMall.Website',
      html: wrapEmailHtml(`
          <h2 style="color: #333;">Confirm your new email</h2>
          <p>We received a request to change the email on your OnlineMall.Website account to <strong>${newEmailNorm}</strong>.</p>
          <p style="margin: 20px 0; font-size: 24px; letter-spacing: 4px;"><strong>${code}</strong></p>
          <p>Enter this 6-digit code in the Change Email popup to finish updating your email address.</p>
          <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not request this change, you can ignore this email. Your current email remains unchanged.</p>
        `)
    });
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `A verification code was sent to ${newEmailNorm}.`,
      newEmail: newEmailNorm
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:submitChangeEmail]', err);
    return res.status(500).json({ error: 'Failed to send verification email.', details: err?.message || '' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changeEmail/complete — body: { verificationCode }
 * Verifies the 6-digit code emailed to the new address and updates the account email.
 */
export async function completeSettingsChangeEmail(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const verificationCode = String(req.body?.verificationCode ?? '').trim().replace(/\D/g, '');
  if (!verificationCode || verificationCode.length !== 6) {
    return res.status(400).json({ error: 'Code from email is invalid. Please retry.' });
  }

  const client = await pool.connect();
  try {
    const contact = await loadSinglesContactForSettings(singlesId);
    if (!contact) {
      return res.status(404).json({ error: 'Member record not found.' });
    }

    const currentEmailNorm = String(contact.email ?? '').trim().toLowerCase();
    const formattedPhone = formatPhoneForStorage(contact.phone);
    if (!currentEmailNorm || !formattedPhone) {
      return res.status(400).json({ error: 'Phone verification is not available for this account.' });
    }

    const cooldown = await assertAccountChangeAllowed(client, singlesId, 'email');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    await client.query('BEGIN');

    const pending = await client.query(
      `SELECT id, email, code, password_hash
       FROM helloworldjunktest.verifications
       WHERE kind = $1
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       FOR UPDATE`,
      [SETTINGS_EMAIL_CHANGE_PENDING_KIND]
    );

    let pendingRow = null;
    for (const row of pending.rows) {
      const meta = parseSettingsEmailChangePendingMeta(row.password_hash);
      if (meta?.singles_id === singlesId) {
        pendingRow = row;
        break;
      }
    }

    if (!pendingRow) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No pending email change found. Please press Submit again.' });
    }

    const pendingMeta = parseSettingsEmailChangePendingMeta(pendingRow.password_hash);
    const newEmailNorm = pendingMeta.new_email;
    const oldEmailNorm = pendingMeta.old_email || currentEmailNorm;
    const storedCode = String(pendingRow.code ?? '').replace(/\D/g, '');

    if (storedCode !== verificationCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code from email is invalid. Please retry.' });
    }

    const smsVerified = await client.query(
      `SELECT id
       FROM helloworldjunktest.verifications
       WHERE email = $1
         AND phone = $2
         AND kind = $3
         AND used_at IS NULL
         AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [currentEmailNorm, formattedPhone, SETTINGS_EMAIL_CHANGE_VERIFIED_KIND]
    );
    if (!smsVerified.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Please verify your phone with SMS before changing email.' });
    }

    const taken = await client.query(
      `SELECT singles_id FROM helloworldjunktest.singles WHERE email = $1 AND singles_id <> $2 LIMIT 1`,
      [newEmailNorm, singlesId]
    );
    if (taken.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That email address is already in use.' });
    }

    const oldEmailHistoryEntry = oldEmailNorm ? buildHistoryArrayEntry(oldEmailNorm) : null;
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET email = $1,
           old_email_array = CASE
             WHEN $3::text IS NULL THEN old_email_array
             ELSE COALESCE(old_email_array, ARRAY[]::text[]) || ARRAY[$3::text]
           END,
           last_email_change_date = CURRENT_DATE,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [newEmailNorm, singlesId, oldEmailHistoryEntry]
    );
    await recordAuditRegistrationChange(client, {
      singlesId,
      email: newEmailNorm,
      phone: formattedPhone
    });
    await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [pendingRow.id]);
    await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [
      smsVerified.rows[0].id
    ]);
    await client.query('COMMIT');

    return res.json({ success: true, message: 'Change successful', email: newEmailNorm });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:completeChangeEmail]', err);
    return res.status(500).json({ error: 'Failed to change email.' });
  } finally {
    client.release();
  }
}

function parseSettingsPhoneChangePendingMeta(passwordHashField) {
  try {
    const parsed = JSON.parse(String(passwordHashField ?? ''));
    const singlesId = Number(parsed?.singles_id);
    const oldPhone = String(parsed?.old_phone ?? '').trim();
    const newPhone = String(parsed?.new_phone ?? '').trim();
    const currentEmail = String(parsed?.current_email ?? '').trim().toLowerCase();
    if (!Number.isFinite(singlesId) || singlesId < 1 || !newPhone) return null;
    return { singles_id: singlesId, old_phone: oldPhone, new_phone: newPhone, current_email: currentEmail };
  } catch {
    return null;
  }
}

async function clearSettingsPhoneChangeForSingles(singlesId, client = pool) {
  const kinds = [
    SETTINGS_PHONE_CHANGE_PENDING_KIND,
    SETTINGS_PHONE_CHANGE_EMAIL_VERIFIED_KIND,
    SETTINGS_PHONE_CHANGE_SMS_SESSION_KIND
  ];
  const pending = await client.query(
    `SELECT id, password_hash
     FROM helloworldjunktest.verifications
     WHERE kind = ANY($1::text[])
       AND used_at IS NULL`,
    [kinds]
  );
  for (const row of pending.rows) {
    const meta = parseSettingsPhoneChangePendingMeta(row.password_hash);
    if (meta?.singles_id === singlesId) {
      await client.query(`UPDATE helloworldjunktest.verifications SET used_at = now() WHERE id = $1`, [row.id]);
    }
  }
}

async function findPhoneChangeVerificationForSingles(client, singlesId, kinds) {
  const result = await client.query(
    `SELECT id, email, phone, code, password_hash, kind
     FROM helloworldjunktest.verifications
     WHERE kind = ANY($1::text[])
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY created_at DESC`,
    [kinds]
  );
  for (const row of result.rows) {
    const meta = parseSettingsPhoneChangePendingMeta(row.password_hash);
    if (meta?.singles_id === singlesId) {
      return { row, meta };
    }
  }
  return null;
}

/**
 * POST /api/settings/changePhone/submit — body: { iconName, currentPassword, newPhone, confirmPhone, currentEmail }
 * Verifies security icon + password, emails 6-digit code to current account email.
 */
export async function submitSettingsChangePhone(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const iconName = req.body?.iconName ?? req.body?.icon;
  const plainCurrent = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
  const newPhoneRaw = String(req.body?.newPhone ?? '').trim();
  const confirmPhoneRaw = String(req.body?.confirmPhone ?? '').trim();
  const currentEmailRaw = String(req.body?.currentEmail ?? '').trim();
  const currentEmailNorm = currentEmailRaw.toLowerCase();
  const newPhoneDigits = normalizePhoneDigits(newPhoneRaw);
  const confirmPhoneDigits = normalizePhoneDigits(confirmPhoneRaw);
  const normalizedIconName = normalizeSecretIconName(iconName);
  const candidateIconHash = hashSecretIconName(normalizedIconName);

  if (!normalizedIconName || !candidateIconHash) {
    return res.status(400).json({ error: 'Please choose a valid security icon.' });
  }

  if (!plainCurrent) {
    return res.status(400).json({ error: 'Current password is required.' });
  }
  if (!newPhoneRaw || !confirmPhoneRaw) {
    return res.status(400).json({ error: 'New phone and confirmation are required.' });
  }
  if (!isValidPhone(newPhoneRaw) || !isValidPhone(confirmPhoneRaw)) {
    return res.status(400).json({ error: 'A valid 10-digit phone number is required.' });
  }
  if (newPhoneDigits !== confirmPhoneDigits) {
    return res.status(400).json({ error: 'New phone entries do not match.' });
  }
  if (!isValidEmail(currentEmailNorm)) {
    return res.status(400).json({ error: 'A valid current email is required.' });
  }

  const newPhoneStored = formatPhoneForStorage(newPhoneRaw);
  if (!newPhoneStored) {
    return res.status(400).json({ error: 'A valid 10-digit phone number is required.' });
  }

  if (!isSmtpConfigured()) {
    return res.status(500).json({
      error: 'Email service not configured.',
      details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
    });
  }

  const client = await pool.connect();
  try {
    const cooldown = await assertAccountChangeAllowed(client, singlesId, 'phone');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    await client.query('BEGIN');

    const iconGate = await verifySecretIconWithAttemptTracking(client, singlesId, candidateIconHash);
    if (!iconGate.ok) {
      await client.query('COMMIT');
      return res.status(iconGate.response.statusCode).json(iconGate.response.body);
    }

    const gate = await verifyCurrentPasswordWithAttemptTracking(client, singlesId, plainCurrent);
    if (!gate.ok) {
      if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      const statusCode = gate.response.statusCode === 401 ? 403 : gate.response.statusCode;
      return res.status(statusCode).json(gate.response.body);
    }

    const accountEmailNorm = String(gate.row.email ?? '').trim().toLowerCase();
    if (!accountEmailNorm) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No email on file for this account.' });
    }
    if (currentEmailNorm !== accountEmailNorm) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Current email does not match this account.' });
    }

    const currentPhoneStored = formatPhoneForStorage(gate.row.phone) || String(gate.row.phone ?? '').trim();
    if (currentPhoneStored && newPhoneStored === currentPhoneStored) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That is already your current phone number.' });
    }

    if (!isDuplicatePhoneAllowed(gate.row.member_category)) {
      const taken = await client.query(
        `SELECT singles_id FROM helloworldjunktest.singles WHERE phone = $1 AND singles_id <> $2 LIMIT 1`,
        [newPhoneStored, singlesId]
      );
      if (taken.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: DUPLICATE_PHONE_ERROR });
      }
    }

    await clearSettingsPhoneChangeForSingles(singlesId, client);

    const code = generateNumericCode();
    const expiresAt = new Date(Date.now() + SETTINGS_ACCOUNT_SMS_SESSION_MS);
    const metaJson = JSON.stringify({
      singles_id: singlesId,
      old_phone: currentPhoneStored,
      new_phone: newPhoneStored,
      current_email: accountEmailNorm
    });

    await client.query(
      `INSERT INTO helloworldjunktest.verifications (email, code, password_hash, kind, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [accountEmailNorm, code, metaJson, SETTINGS_PHONE_CHANGE_PENDING_KIND, expiresAt]
    );

    const transporter = createTransporter();
    const newPhoneDisplay = formatPhoneForDisplay(newPhoneStored);
    await sendOutboundMail(transporter, {
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: accountEmailNorm,
      subject: 'Your phone change verification code - OnlineMall.Website',
      html: wrapEmailHtml(`
          <h2 style="color: #333;">Confirm your phone change</h2>
          <p>We received a request to change the phone number on your OnlineMall.Website account to <strong>${newPhoneDisplay}</strong>.</p>
          <p style="margin: 20px 0; font-size: 24px; letter-spacing: 4px;"><strong>${code}</strong></p>
          <p>Enter this 6-digit code in the Change Phone popup to continue updating your phone number.</p>
          <p style="margin-top: 30px; color: #999; font-size: 12px;">If you did not request this change, you can ignore this email. Your current phone number remains unchanged.</p>
        `)
    });
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `A verification code was sent to ${accountEmailNorm}.`,
      email: accountEmailNorm,
      phone: newPhoneStored
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:submitChangePhone]', err);
    return res.status(500).json({ error: 'Failed to send verification email.', details: err?.message || '' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changePhone/verifyEmailCode — body: { verificationCode }
 */
export async function verifySettingsChangePhoneEmailCode(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const verificationCode = String(req.body?.verificationCode ?? '').trim().replace(/\D/g, '');
  if (!verificationCode || verificationCode.length !== 6) {
    return res.status(400).json({ error: 'Code from email is invalid. Please retry.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await findPhoneChangeVerificationForSingles(client, singlesId, [SETTINGS_PHONE_CHANGE_PENDING_KIND]);
    if (!found) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No pending phone change found. Please press Submit again.' });
    }

    const storedCode = String(found.row.code ?? '').replace(/\D/g, '');
    if (storedCode !== verificationCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code from email is invalid. Please retry.' });
    }

    await client.query(
      `UPDATE helloworldjunktest.verifications
       SET kind = $1
       WHERE id = $2`,
      [SETTINGS_PHONE_CHANGE_EMAIL_VERIFIED_KIND, found.row.id]
    );
    await client.query('COMMIT');

    return res.json({
      success: true,
      verified: true,
      message: 'Verify email code PASSES',
      phone: found.meta.new_phone
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:verifyChangePhoneEmailCode]', err);
    return res.status(500).json({ error: 'Failed to verify email code.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/settings/changePhone/sendSms — auth required; Twilio SMS to new phone from pending change.
 */
export async function sendSettingsChangePhoneSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const found = await findPhoneChangeVerificationForSingles(pool, singlesId, [
      SETTINGS_PHONE_CHANGE_EMAIL_VERIFIED_KIND
    ]);
    if (!found) {
      return res.status(400).json({ error: 'Please verify the email code before sending an SMS code.' });
    }

    const newPhoneStored = found.meta.new_phone;
    const currentEmailNorm = found.meta.current_email;
    if (!newPhoneStored || !currentEmailNorm) {
      return res.status(400).json({ error: 'Invalid phone change session. Please press Submit again.' });
    }

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    await pool.query(
      `UPDATE helloworldjunktest.verifications
       SET used_at = now()
       WHERE kind = $1
         AND used_at IS NULL
         AND phone = $2
         AND email = $3`,
      [SETTINGS_PHONE_CHANGE_SMS_SESSION_KIND, newPhoneStored, currentEmailNorm]
    );

    const expiresAt = new Date(Date.now() + SETTINGS_ACCOUNT_SMS_SESSION_MS);
    await pool.query(
      `INSERT INTO helloworldjunktest.verifications (email, phone, password_hash, kind, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [currentEmailNorm, newPhoneStored, found.row.password_hash, SETTINGS_PHONE_CHANGE_SMS_SESSION_KIND, expiresAt]
    );
    await sendTwilioVerificationSms(newPhoneStored);

    return res.json({
      success: true,
      message: 'Verification code sent to your new phone',
      phone: newPhoneStored
    });
  } catch (err) {
    console.error('[settingsAccount:sendChangePhoneSms]', err);
    return res.status(500).json({ error: 'Failed to send verification SMS.' });
  }
}

/**
 * POST /api/settings/changePhone/verifySms — body: { verificationCode }
 */
export async function verifySettingsChangePhoneSms(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const verificationCode = String(req.body?.verificationCode ?? '').trim().replace(/\D/g, '');
  if (!verificationCode || verificationCode.length !== 6) {
    return res.status(400).json({
      error: 'Invalid verification code',
      details: 'The verification code must be exactly 6 digits.'
    });
  }

  const client = await pool.connect();
  try {
    const found = await findPhoneChangeVerificationForSingles(client, singlesId, [
      SETTINGS_PHONE_CHANGE_SMS_SESSION_KIND
    ]);
    if (!found) {
      return res.status(400).json({
        error: 'Verification session not found. Please press Send SMS Code again.'
      });
    }

    const newPhoneStored = found.meta.new_phone;
    const oldPhoneStored = found.meta.old_phone || '';

    if (!isTwilioVerifyConfigured()) {
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Configure Twilio Verify in ~/.ssh/be/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID).'
      });
    }

    const approved = await checkTwilioVerificationCode(newPhoneStored, verificationCode);
    if (!approved) {
      return res.status(400).json({
        error: 'SMS code incorrect. Please retry.',
        details: 'SMS code incorrect. Please retry.'
      });
    }

    const cooldown = await assertAccountChangeAllowed(client, singlesId, 'phone');
    if (cooldown) {
      return res.status(cooldown.statusCode).json(cooldown.body);
    }

    await client.query('BEGIN');

    const oldPhoneHistoryEntry = oldPhoneStored ? buildHistoryArrayEntry(oldPhoneStored) : null;
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET phone = $1,
           old_phone_array = CASE
             WHEN $3::text IS NULL THEN old_phone_array
             ELSE COALESCE(old_phone_array, ARRAY[]::text[]) || ARRAY[$3::text]
           END,
           last_phone_change_date = CURRENT_DATE,
           password_attempt_count = 1,
           password_attempt_datetime = $4::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [newPhoneStored, singlesId, oldPhoneHistoryEntry, PASSWORD_ATTEMPT_EPOCH]
    );

    await recordAuditRegistrationChange(client, {
      singlesId,
      email: found.meta.current_email,
      phone: newPhoneStored
    });

    await clearSettingsPhoneChangeForSingles(singlesId, client);
    await client.query('COMMIT');

    return res.json({
      success: true,
      verified: true,
      message: 'Phone number updated successfully.',
      phone: newPhoneStored
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[settingsAccount:verifyChangePhoneSms]', err);
    return res.status(500).json({ error: 'Failed to verify SMS code.' });
  } finally {
    client.release();
  }
}

/**
 * PUT /api/settings/altEmail — body: { altEmail }
 * Empty/null clears it. While set, outbound mail to the account email is copied here.
 */
export async function updateSettingsAltEmail(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const raw = String(req.body?.altEmail ?? '').trim();
  const altEmail = raw ? normalizeEmailForDb(raw) : null;
  if (raw && !isValidEmail(raw)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.singles
          SET alt_email = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE singles_id = $2
          AND ($1::text IS NULL OR LOWER(email) <> $1::text)
        RETURNING alt_email`,
      [altEmail, singlesId]
    );

    if (!rows.length) {
      return res.status(400).json({
        error: 'Your Alt/2nd Email must be different from your main email.'
      });
    }

    return res.json({
      success: true,
      alt_email: rows[0].alt_email || null,
      message: altEmail ? 'Alt/2nd Email saved.' : 'Alt/2nd Email removed.'
    });
  } catch (err) {
    console.error('[settingsAccount:updateAltEmail]', err);
    return res.status(500).json({ error: 'Failed to save Alt/2nd Email.' });
  }
}
