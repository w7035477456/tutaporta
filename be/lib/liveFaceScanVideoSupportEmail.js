import nodemailer from 'nodemailer';
import { OUTBOUND_EMAIL_FROM_HEADER } from './emailFrom.js';
import { wrapEmailHtml } from './emailHtml.js';
import { sendOutboundMail } from './outboundMail.js';
import { getPublicAppUrl } from '../utils/publicAppUrl.js';

const DEFAULT_SUPPORT_TO = 'support@onlinemail.website';
const LOG_PREFIX = '[liveFaceScanVideoSupportEmail]';

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

export function getLiveFaceScanVideoSupportEmailTo() {
  const override = String(process.env.LIVE_SCAN_VIDEO_SUPPORT_EMAIL ?? '').trim();
  return override || DEFAULT_SUPPORT_TO;
}

export function buildLiveFaceScanVideoViewLink(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `${getPublicAppUrl()}/api/video/${id}`;
}

export function formatLiveFaceScanVideoViewLabel(videoId) {
  const id = Number(videoId);
  if (!Number.isFinite(id) || id < 1) return '';
  return `VIEW_100${id}`;
}

/**
 * @param {{ singlesId: number, memberLabel: string, email: string, fullNameSigned: string, videoId: number }} params
 */
export async function sendLiveFaceScanVideoSupportEmail({
  singlesId,
  memberLabel,
  email,
  fullNameSigned,
  videoId
}) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping support email`);
    return { sent: false, skipped: true };
  }

  const videoLink = buildLiveFaceScanVideoViewLink(videoId);
  const viewLabel = formatLiveFaceScanVideoViewLabel(videoId);
  const supportTo = getLiveFaceScanVideoSupportEmailTo();
  const subject = `Live Face Scan fallback video — ${memberLabel || email || singlesId}`;
  const bodyHtml = wrapEmailHtml(`
    <h2 style="color:#333;margin-top:0;">Live Face Scan fallback video</h2>
    <p style="margin:0 0 16px;">A member sent a 30-second live face scan fallback video after live scan confidence was below the minimum.</p>
    <p style="margin:0;"><strong>Member:</strong> ${escapeHtml(memberLabel || '—')}</p>
    <p style="margin:4px 0 0;"><strong>Email:</strong> ${escapeHtml(email || '—')}</p>
    <p style="margin:4px 0 0;"><strong>Singles ID:</strong> ${escapeHtml(String(singlesId))}</p>
    <p style="margin:4px 0 0;"><strong>Full name signed:</strong> ${escapeHtml(fullNameSigned || '—')}</p>
    <p style="margin:16px 0 0;"><strong>Consent link label:</strong> ${escapeHtml(viewLabel)}</p>
    <p style="margin:8px 0 0;"><a href="${escapeHtml(videoLink)}">${escapeHtml(videoLink)}</a></p>
  `);

  const transporter = createTransporter();
  await sendOutboundMail(transporter, {
    from: OUTBOUND_EMAIL_FROM_HEADER,
    to: supportTo,
    replyTo: email || undefined,
    subject,
    html: bodyHtml,
    text: `Live Face Scan fallback video from ${memberLabel || email}.\nVideo link: ${videoLink}\nConsent label: ${viewLabel}\n`
  });

  return { sent: true, to: supportTo, videoLink, viewLabel };
}
