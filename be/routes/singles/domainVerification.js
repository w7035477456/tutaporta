import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { buildDomainVerificationEmailHtml } from '../../lib/domainVerificationEmail.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { enrichMailOptions } from '../../lib/emailHtml.js';
import { loadTableColumns, resolveBioSchema, sqlIdent, upsertBioRow } from './checkrBioReviewDb.js';
import { setVetBioVerificationStatus } from '../../utils/vetBioVerificationServices.js';
import { trackUserSearchEvent } from '../../utils/userActivityStats.js';

const CODE_EXPIRY_MS = 5 * 60 * 1000;

function normalizeVerificationCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(6, '0').slice(-6);
}

function isValidEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateSixDigitCode() {
  return normalizeVerificationCode(crypto.randomInt(0, 1_000_000));
}

function extractDomainFromEmail(email) {
  const parts = String(email).trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].trim();
  return domain || null;
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

async function upsertVetBioFields(singlesId, fields) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  const skippedFields = Object.keys(fields).filter((key) => !vetColumns.has(key));
  if (skippedFields.length) {
    throw new Error(`vet_bio columns unavailable: ${skippedFields.join(', ')}`);
  }
  await upsertBioRow(pool, schemaName, 'vet_bio', singlesId, fields, vetColumns);
}

async function readPendingDomainVerification(singlesId) {
  const schemaName = await resolveBioSchema();
  const schema = sqlIdent(schemaName);
  const result = await pool.query(
    `SELECT company_email, email_verification_code, email_verification_time_sent
     FROM ${schema}.vet_bio
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return result.rows[0] ?? null;
}

const SQL_NORMALIZED_CODE = `LPAD(REGEXP_REPLACE(COALESCE(email_verification_code::text, ''), '[^0-9]', '', 'g'), 6, '0')`;

/**
 * POST /api/domain-verification/send-code
 * Body: { companyEmail }
 */
export async function sendDomainVerificationCode(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const companyEmail = String(req.body?.companyEmail ?? '').trim().toLowerCase();
  if (!isValidEmail(companyEmail)) {
    return res.status(400).json({ error: 'A valid company email is required' });
  }

  const domain = extractDomainFromEmail(companyEmail);
  if (!domain) {
    return res.status(400).json({ error: 'Could not read domain from email address' });
  }

  try {
    await trackUserSearchEvent(singlesId, 'work_email_domain_search', { companyEmail });
    const schemaName = await resolveBioSchema();
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    if (!vetColumns.has('company_email') || !vetColumns.has('email_verification_code')) {
      return res.status(500).json({
        error: 'Domain verification columns are not available on vet_bio (company_email, email_verification_code)'
      });
    }
    if (!vetColumns.has('email_verification_time_sent')) {
      return res.status(500).json({
        error:
          'Domain verification requires vet_bio.email_verification_time_sent. Add this column and retry Send code.'
      });
    }

    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    await pool.query('BEGIN');
    try {
      await pool.query('SELECT pg_advisory_xact_lock($1::bigint)', [singlesId]);
      await upsertVetBioFields(singlesId, {
        company_email: companyEmail,
        email_verification_code: code,
        email_verification_time_sent: new Date()
      });

      const savedRow = await readPendingDomainVerification(singlesId);
      const savedCode = normalizeVerificationCode(savedRow?.email_verification_code);
      const savedEmail = String(savedRow?.company_email ?? '').trim().toLowerCase();
      if (savedCode !== code || savedEmail !== companyEmail) {
        throw new Error('Verification code was not saved to vet_bio');
      }
      await pool.query('COMMIT');
    } catch (saveError) {
      try {
        await pool.query('ROLLBACK');
      } catch {
        // ignore
      }
      console.error('[domainVerification:sendCode] persist failed', saveError?.message || saveError);
      return res.status(500).json({
        error: 'Verification code could not be saved. Ask support to check vet_bio.email_verification_code on Primary.'
      });
    }

    const mockMode = String(process.env.DOMAIN_VERIFICATION_MOCK || '').toLowerCase() === 'true';
    if (mockMode) {
      console.log('[domainVerification:mock] code for', companyEmail, '=', code);
      return res.json({
        success: true,
        message: 'Verification code saved (mock mode — email not sent).',
        companyEmail,
        domain,
        expiresAt: expiresAt.toISOString(),
        mockCode: code
      });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({
        error: 'Email service not configured. Set SMTP_USER and SMTP_PASS in ~/.ssh/be/.env'
      });
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPortNum,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '')
      }
    });

    await transporter.sendMail(
      enrichMailOptions({
        from: OUTBOUND_EMAIL_FROM_HEADER,
        to: companyEmail,
        subject: 'Your company domain verification code',
        html: buildDomainVerificationEmailHtml({ code, companyEmail })
      })
    );

    return res.json({
      success: true,
      message: `Verification code sent to ${companyEmail}.`,
      companyEmail,
      domain,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('[domainVerification:sendCode]', error?.message || error);
    return res.status(500).json({ error: 'Failed to send verification code' });
  }
}

/**
 * POST /api/domain-verification/verify
 * Body: { code, companyEmail }
 */
export async function verifyDomainVerificationCode(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const code = normalizeVerificationCode(req.body?.code);
  const companyEmailFromBody = String(req.body?.companyEmail ?? '').trim().toLowerCase();
  if (code.length !== 6) {
    return res.status(400).json({ error: 'A 6-digit verification code is required' });
  }
  if (!isValidEmail(companyEmailFromBody)) {
    return res.status(400).json({ error: 'Company email is required to verify the code' });
  }

  const domainFromBody = extractDomainFromEmail(companyEmailFromBody);

  try {
    const schemaName = await resolveBioSchema();
    const schema = sqlIdent(schemaName);
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    if (!vetColumns.has('company_email') || !vetColumns.has('email_verification_code')) {
      return res.status(500).json({ error: 'Domain verification columns are not available' });
    }
    if (!vetColumns.has('email_verification_time_sent')) {
      return res.status(500).json({
        error:
          'Domain verification requires vet_bio.email_verification_time_sent. Add this column and retry Verify code.'
      });
    }

    const pendingRes = await pool.query(
      `SELECT company_email, email_verification_code, email_verification_time_sent,
              ${SQL_NORMALIZED_CODE} AS normalized_code,
              (email_verification_time_sent > NOW() - INTERVAL '5 minutes') AS is_fresh
       FROM ${schema}.vet_bio
       WHERE singles_id = $1
         AND email_verification_code IS NOT NULL
         AND company_email IS NOT NULL
         AND email_verification_time_sent IS NOT NULL
       LIMIT 1`,
      [singlesId]
    );
    const pending = pendingRes.rows[0];

    if (!pending) {
      return res.status(400).json({ error: 'No verification in progress. Click Send code again.' });
    }

    const storedEmail = String(pending.company_email ?? '').trim().toLowerCase();
    const storedDomain = extractDomainFromEmail(storedEmail);
    const domain = storedDomain || domainFromBody;

    if (storedEmail !== companyEmailFromBody) {
      return res.status(400).json({
        error: `Verification was started for ${storedEmail}. Click Send code again for ${companyEmailFromBody}.`,
        companyDomain: domain
      });
    }

    if (!pending.is_fresh) {
      return res.status(400).json({
        error: 'Verification code expired. Click Send code again (valid for 5 minutes).',
        companyDomain: domain
      });
    }

    const storedCode = normalizeVerificationCode(pending.normalized_code ?? pending.email_verification_code);
    if (storedCode !== code) {
      console.warn('[domainVerification:verify] code mismatch for member', singlesId, {
        storedCodeLength: storedCode.length,
        submittedCodeLength: code.length
      });
      return res.status(400).json({
        error: domain
          ? `Company Domain ${domain} verification code incorrect. Use the code from the most recent email, or click Send code again.`
          : 'Company Domain verification code incorrect. Use the code from the most recent email, or click Send code again.',
        companyDomain: domain
      });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Could not read domain from stored company email' });
    }

    const now = new Date();
    const updateFields = {
      company_email: storedEmail,
      email_verification_code: null,
      email_verification_time_sent: null
    };
    if (vetColumns.has('company_domain_name')) {
      updateFields.company_domain_name = domain;
    }
    if (vetColumns.has('company_domain_name_vetted')) {
      updateFields.company_domain_name_vetted = 'info_matches';
    }
    if (vetColumns.has('company_domain_name_vetted_date')) {
      updateFields.company_domain_name_vetted_date = now;
    }
    if (vetColumns.has('company_domain_name_vetted_note')) {
      updateFields.company_domain_name_vetted_note = `Verified company email ${storedEmail}`;
    }

    await upsertVetBioFields(singlesId, updateFields);
    const workStatusOk = await setVetBioVerificationStatus(singlesId, 'work', 'completed');
    if (!workStatusOk) {
      return res.status(500).json({
        error: 'Work verification status could not be saved. Run addVetBioVerificationStatusColumns.sql and addVetBioVerificationDateColumns.sql.'
      });
    }

    return res.json({
      success: true,
      message: domain
        ? `Company Domain ${domain} verification correct`
        : 'Company domain verified.',
      companyEmail: storedEmail,
      companyDomain: domain,
      companyDomainVetted: 'info_matches'
    });
  } catch (error) {
    console.error('[domainVerification:verify]', error?.message || error);
    return res.status(500).json({ error: 'Failed to verify domain' });
  }
}
