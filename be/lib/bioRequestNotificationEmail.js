import nodemailer from 'nodemailer';
import pool from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from './emailFrom.js';
import { enrichMailOptions } from './emailHtml.js';
import { getPublicAppUrl } from '../utils/publicAppUrl.js';

const LOG_PREFIX = '[bioRequestNotificationEmail]';

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

function formatMemberLabel({ alias, prefix, memberId, fallback = 'Member' } = {}) {
  const name = String(alias ?? '').trim();
  const code =
    prefix != null && memberId != null && String(memberId).trim() !== ''
      ? `${String(prefix).trim()}${String(memberId).trim()}`
      : '';
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return fallback;
}

export function buildIncomingBioRequestPhrase({ briefRequested = false, fullRequested = false } = {}) {
  if (briefRequested && fullRequested) return 'Brief and Full Bio';
  if (briefRequested) return 'Brief Bio';
  if (fullRequested) return 'Full Bio';
  return 'Bio';
}

export function buildIncomingBioRequestBellMessage({
  requesterLabel,
  recipientLabel,
  briefRequested = false,
  fullRequested = false
} = {}) {
  const requester = String(requesterLabel ?? '').trim() || 'Member';
  const recipient = String(recipientLabel ?? '').trim() || 'you';
  const bioPhrase = buildIncomingBioRequestPhrase({ briefRequested, fullRequested });
  return `${requester} is requesting ${bioPhrase} of ${recipient}`;
}

function buildEmailBodies({ requesterLabel, recipientLabel, briefRequested, fullRequested, actionUrl }) {
  const bellLine = buildIncomingBioRequestBellMessage({
    requesterLabel,
    recipientLabel,
    briefRequested,
    fullRequested
  });
  const subject = `Bio request from ${requesterLabel}`;
  const text = `${bellLine}.\n\nSign in to respond on Received Bio Requests:\n${actionUrl}\n`;
  const html = `<p>${bellLine}.</p><p><a href="${actionUrl}">Open Received Bio Requests</a> to approve or deny.</p>`;
  return { subject, text, html };
}

/**
 * Fire-and-forget email when a member newly requests brief/full bio.
 */
export function sendBioRequestNotificationEmailFireAndForget({
  requesterSinglesId,
  recipientSinglesId,
  briefRequested = false,
  fullRequested = false
} = {}) {
  if (!briefRequested && !fullRequested) return;
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping email`);
    return;
  }

  void (async () => {
    try {
      const ids = [Number(requesterSinglesId), Number(recipientSinglesId)].filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length !== 2) return;

      const { rows } = await pool.query(
        `SELECT singles_id, email, alias, prefix, member_id
         FROM helloworldjunktest.singles
         WHERE singles_id = ANY($1::bigint[])`,
        [ids]
      );
      const byId = new Map(rows.map((row) => [Number(row.singles_id), row]));
      const requester = byId.get(Number(requesterSinglesId));
      const recipient = byId.get(Number(recipientSinglesId));
      const toEmail = String(recipient?.email ?? '')
        .trim()
        .toLowerCase();
      if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        console.warn(`${LOG_PREFIX} recipient email missing for singles_id=${recipientSinglesId}`);
        return;
      }

      const requesterLabel = formatMemberLabel(requester);
      const recipientLabel = formatMemberLabel(recipient);
      const actionUrl = `${getPublicAppUrl()}/receivedBioRequests?focusRequester=${Number(requesterSinglesId)}`;
      const { subject, text, html } = buildEmailBodies({
        requesterLabel,
        recipientLabel,
        briefRequested,
        fullRequested,
        actionUrl
      });

      const transporter = createTransporter();
      await transporter.sendMail(
        enrichMailOptions({
          from: OUTBOUND_EMAIL_FROM_HEADER,
          to: toEmail,
          subject,
          text,
          html
        })
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} send failed`, err?.message ?? err);
    }
  })();
}
