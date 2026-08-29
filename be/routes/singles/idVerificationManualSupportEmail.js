import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { OUTBOUND_EMAIL_FROM_ADDRESS, OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { wrapEmailHtml } from '../../lib/emailHtml.js';
import { sendOutboundMail } from '../../lib/outboundMail.js';
import { loadProfilePhotoBytes } from '../../utils/loadProfilePhotoBytes.js';
import { prepareGovIdImageBytes } from '../../utils/prepareGovIdImageBytes.js';

const SUPPORT_TO = OUTBOUND_EMAIL_FROM_ADDRESS;
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const EXTRACTED_FIELD_DEFS = [
  { key: 'documentType', label: 'Document type' },
  { key: 'firstName', label: 'First name' },
  { key: 'middleInitial', label: 'Middle initial' },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'age', label: 'Age' },
  { key: 'sex', label: 'Sex' },
  { key: 'height', label: 'Height' },
  { key: 'city', label: 'City' },
  { key: 'address', label: 'Address' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'ppNationality', label: 'Passport nationality' },
  { key: 'countryOfBirth', label: 'Country of birth' },
  { key: 'countryOfCitizenship', label: 'Country of citizenship' }
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function decodeDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = (match ? match[1] : 'image/jpeg').trim().toLowerCase();
  const base64 = match ? match[2] : dataUrl;
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Government ID image must be JPEG, PNG, or WebP');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Invalid government ID image data');
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error('Government ID image exceeds 7 MB attachment limit');
  }
  return { buffer, contentType };
}

function extensionFromMime(contentType) {
  const mime = String(contentType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function formatMemberLabel({ alias, prefix, memberId } = {}) {
  const name = String(alias ?? '').trim();
  const code =
    prefix != null && memberId != null && String(memberId).trim() !== ''
      ? `${String(prefix).trim()}${String(memberId).trim()}`
      : '';
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return '—';
}

function formatExtractedFieldRows(extracted) {
  const data = extracted && typeof extracted === 'object' ? extracted : {};
  return EXTRACTED_FIELD_DEFS.map(({ key, label }) => {
    const raw = data[key];
    const found = raw != null && String(raw).trim() !== '';
    return {
      label,
      value: found ? String(raw).trim() : 'not found',
      found
    };
  });
}

function buildExtractedFieldsHtml(extracted, passportLabelsFound) {
  const rows = formatExtractedFieldRows(extracted);
  const labels = Array.isArray(passportLabelsFound)
    ? passportLabelsFound.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  const fieldRowsHtml = rows
    .map(
      ({ label, value, found }) =>
        `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;"><strong>${escapeHtml(label)}:</strong></td><td style="padding:4px 0;color:${found ? '#111' : '#b71c1c'};">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const labelsHtml = labels.length
    ? `<p style="margin:12px 0 0;"><strong>Passport labels found:</strong> ${escapeHtml(labels.join(', '))}</p>`
    : `<p style="margin:12px 0 0;"><strong>Passport labels found:</strong> not found</p>`;

  return `<table style="border-collapse:collapse;font-size:14px;">${fieldRowsHtml}</table>${labelsHtml}`;
}

function normalizeErrors(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function buildErrorsHtml(errors) {
  const list = normalizeErrors(errors);
  if (!list.length) {
    return '<p style="margin:0;">No errors reported.</p>';
  }
  return `<ul style="margin:0;padding-left:20px;">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

/**
 * POST /api/rekognition/manual-support-email
 * Body: { idImage?, errors?, extracted?, passportLabelsFound?, consentName?, markedSlots? }
 * Sends one email to support with profile photo, gov ID, user info, errors, and extracted fields.
 */
export async function postIdVerificationManualSupportEmail(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT email, phone, alias, prefix, member_id, profile_image_fk
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userRow = rows[0];
    const memberLabel = formatMemberLabel(userRow);
    const email = String(userRow.email ?? '').trim() || '—';
    const phone = String(userRow.phone ?? '').trim() || '—';

    const errors = normalizeErrors(req.body?.errors);
    const extracted = req.body?.extracted && typeof req.body.extracted === 'object' ? req.body.extracted : {};
    const passportLabelsFound = Array.isArray(req.body?.passportLabelsFound) ? req.body.passportLabelsFound : [];
    const consentName = String(req.body?.consentName ?? '').trim() || '—';
    const markedSlots = Array.isArray(req.body?.markedSlots)
      ? req.body.markedSlots.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    const attachments = [];
    let profilePhotoNote = '';
    try {
      const profileBytes = await loadProfilePhotoBytes(singlesId);
      if (profileBytes.length > MAX_ATTACHMENT_BYTES) {
        profilePhotoNote = 'Profile photo exceeds 7 MB and was omitted from attachments.';
      } else {
        attachments.push({
          filename: `profile-photo-${singlesId}.jpg`,
          content: profileBytes,
          contentType: 'image/jpeg'
        });
      }
    } catch (err) {
      profilePhotoNote = String(err?.message || 'Profile photo unavailable');
    }

    let govIdNote = '';
    const attachGovIdImage = async (dataUrl, filenamePrefix) => {
      const decoded = decodeDataUrlImage(dataUrl);
      if (!decoded) return;
      const resizedBuffer = await prepareGovIdImageBytes(decoded.buffer);
      attachments.push({
        filename: `${filenamePrefix}-${singlesId}.jpg`,
        content: resizedBuffer,
        contentType: 'image/jpeg'
      });
    };

    const driverLicenseImageRaw = req.body?.driverLicenseImage || req.body?.idImage;
    const passportImageRaw = req.body?.passportImage;
    const govIdNotes = [];

    if (driverLicenseImageRaw) {
      try {
        await attachGovIdImage(driverLicenseImageRaw, 'driver-license');
      } catch (err) {
        govIdNotes.push(`Driver license: ${String(err?.message || 'image unavailable')}`);
      }
    } else {
      govIdNotes.push('Driver license: not uploaded');
    }

    if (passportImageRaw) {
      try {
        await attachGovIdImage(passportImageRaw, 'passport');
      } catch (err) {
        govIdNotes.push(`Passport: ${String(err?.message || 'image unavailable')}`);
      }
    } else {
      govIdNotes.push('Passport: not uploaded');
    }

    if (govIdNotes.length) {
      govIdNote = govIdNotes.join('; ');
    }

    if (!isSmtpConfigured()) {
      console.error('[idVerificationManualSupportEmail] SMTP not configured');
      return res.status(500).json({
        error: 'Email service not configured.',
        details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
      });
    }

    const subject = `Manual ID verification — ${memberLabel !== '—' ? memberLabel : email}`;
    const markedSlotsLabel = markedSlots.length ? markedSlots.join(', ') : 'Support manual process';

    const bodyHtml = wrapEmailHtml(`
      <h2 style="color:#333;margin-top:0;">Marked for manual Process by Support</h2>
      <p style="margin:0 0 16px;">A member requested manual identity verification review.</p>
      <h3 style="color:#333;margin:24px 0 8px;">Member</h3>
      <p style="margin:0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="margin:4px 0 0;"><strong>Alias:</strong> ${escapeHtml(memberLabel)}</p>
      <p style="margin:4px 0 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p style="margin:4px 0 0;"><strong>Singles ID:</strong> ${escapeHtml(String(singlesId))}</p>
      <p style="margin:4px 0 0;"><strong>User-entered legal name:</strong> ${escapeHtml(consentName)}</p>
      <p style="margin:4px 0 0;"><strong>Marked slots:</strong> ${escapeHtml(markedSlotsLabel)}</p>
      <h3 style="color:#333;margin:24px 0 8px;">Errors encountered</h3>
      ${buildErrorsHtml(errors)}
      <h3 style="color:#333;margin:24px 0 8px;">Extracted from Government ID (found / not found)</h3>
      ${buildExtractedFieldsHtml(extracted, passportLabelsFound)}
      <h3 style="color:#333;margin:24px 0 8px;">Attachments</h3>
      <p style="margin:0;">${attachments.length} image attachment(s) included.</p>
      ${profilePhotoNote ? `<p style="margin:8px 0 0;color:#b71c1c;">Profile photo: ${escapeHtml(profilePhotoNote)}</p>` : ''}
      ${govIdNote ? `<p style="margin:8px 0 0;color:#b71c1c;">Government ID: ${escapeHtml(govIdNote)}</p>` : ''}
    `);

    const transporter = createTransporter();
    await sendOutboundMail(transporter, {
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: SUPPORT_TO,
      replyTo: email !== '—' ? email : undefined,
      subject,
      html: bodyHtml,
      attachments
    });

    return res.json({ success: true, message: 'Support has been notified for manual review.' });
  } catch (err) {
    console.error('[idVerificationManualSupportEmail] error:', err);
    return res.status(500).json({
      error: 'Failed to notify support.',
      details: err?.message || 'Unknown error'
    });
  }
}
