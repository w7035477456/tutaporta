import nodemailer from 'nodemailer';
import { OUTBOUND_EMAIL_FROM_ADDRESS, OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../lib/emailHtml.js';

const SUPPORT_TO = OUTBOUND_EMAIL_FROM_ADDRESS;
const MAX_ATTACHMENTS = 2;
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
const MAX_FILE_ERROR = '7mb max per file';
const MAX_MESSAGE_LENGTH = 8000;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return { attachments: [], error: null };
  const out = [];
  for (const item of raw.slice(0, MAX_ATTACHMENTS)) {
    const filename = String(item?.filename ?? '').trim() || 'attachment';
    const contentBase64 = String(item?.contentBase64 ?? '').trim();
    if (!contentBase64) continue;
    let buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch {
      continue;
    }
    if (!buffer.length) continue;
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      return { attachments: [], error: MAX_FILE_ERROR };
    }
    out.push({
      filename: filename.slice(0, 200),
      content: buffer,
      contentType: String(item?.mimeType ?? 'application/octet-stream').slice(0, 120)
    });
  }
  return { attachments: out, error: null };
}

/**
 * POST /api/supportMessage — body: { name, email, message, attachments? }
 * Sends to support@onlinemall.website and CCs the submitter.
 */
export async function postSupportMessage(req, res) {
  try {
    const name = String(req.body?.name ?? '').trim();
    const emailRaw = String(req.body?.email ?? '').trim();
    const message = String(req.body?.message ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Your name is required.' });
    }
    if (!isValidEmail(emailRaw)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Please describe how we can help you.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }

    const emailNorm = emailRaw.toLowerCase();
    if (Array.isArray(req.body?.attachments) && req.body.attachments.length > MAX_ATTACHMENTS) {
      return res.status(400).json({ error: `You can attach up to ${MAX_ATTACHMENTS} files.` });
    }
    const { attachments, error: attachmentError } = normalizeAttachments(req.body?.attachments);
    if (attachmentError) {
      return res.status(400).json({ error: attachmentError });
    }

    if (!isSmtpConfigured()) {
      console.error('[supportMessage] SMTP not configured');
      return res.status(500).json({
        error: 'Email service not configured.',
        details: 'SMTP_USER and SMTP_PASS must be set in the server environment.'
      });
    }

    const transporter = createTransporter();
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(emailNorm);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

    await transporter.sendMail(
      enrichMailOptions({
        from: OUTBOUND_EMAIL_FROM_HEADER,
        to: SUPPORT_TO,
        cc: emailNorm,
        replyTo: `"${name.replace(/"/g, '')}" <${emailNorm}>`,
        subject: `Support message from ${name}`,
        html: wrapEmailHtml(`
          <h2 style="color: #333;">Leave us a message</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${safeMessage}</p>
          ${attachments.length ? `<p style="color: #666; font-size: 12px;">${attachments.length} attachment(s) included.</p>` : ''}
        `),
        attachments
      })
    );

    return res.json({ success: true, message: 'Your message was sent. A copy was emailed to you.' });
  } catch (err) {
    console.error('[supportMessage] error:', err);
    return res.status(500).json({
      error: 'Failed to send your message.',
      details: err?.message || 'Unknown error'
    });
  }
}
