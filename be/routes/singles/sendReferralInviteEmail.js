import nodemailer from 'nodemailer';
import pool from '../../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { sendOutboundMail } from '../../lib/outboundMail.js';
import {
  buildReferralInviteEmailHtml,
  buildReferralInviteEmailPlain,
  buildRegistrationReferralUrl,
  formatReferralInviteMemberGreeting
} from '../../lib/referralInviteEmail.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import { referCodeFromMemberId } from '../../utils/referCodeFromMemberId.js';

const LOG_PREFIX = '[sendReferralInviteEmail]';
const REFERRAL_EMAIL_FROM = OUTBOUND_EMAIL_FROM_HEADER;

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

/** POST /api/settings/referralInviteEmail — email member a forwardable invite message. */
export async function sendReferralInviteEmail(req, res) {
  try {
    const singlesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const toEmailRaw = req.body?.email;
    const forwardedMessage = String(req.body?.forwardedMessage ?? '').trim();
    const toEmail = String(toEmailRaw ?? '').trim().toLowerCase();
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const { rows } = await pool.query(
      `SELECT singles_id, email, alias, member_id, my_refer_code
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    let referCode = String(row.my_refer_code ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(referCode) && row.member_id != null) {
      referCode = referCodeFromMemberId(row.member_id) || '';
    }
    if (!/^\d{6}$/.test(referCode)) {
      return res.status(400).json({
        error: 'Your referral code is not available yet. Complete registration to generate your invite link.'
      });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({
        error: 'Email service not configured',
        details: 'SMTP is not configured on the server.'
      });
    }

    const publicSiteUrl = getPublicAppUrl();
    const referralUrl = buildRegistrationReferralUrl(publicSiteUrl, referCode);
    const memberGreeting = formatReferralInviteMemberGreeting({
      alias: row.alias,
      memberId: row.member_id
    });

    const transporter = createTransporter();
    await sendOutboundMail(transporter, {
      from: REFERRAL_EMAIL_FROM,
      to: toEmail,
      subject: 'Your friend invitation link - OnlineMall.Website',
      text: buildReferralInviteEmailPlain({
        memberGreeting,
        referralUrl,
        referCode,
        forwardedMessage
      }),
      html: buildReferralInviteEmailHtml({
        memberGreeting,
        referralUrl,
        referCode,
        forwardedMessage
      })
    });

    console.log(LOG_PREFIX, 'sent', { singlesId, toPrefix: `${toEmail.slice(0, 3)}***`, referCode });
    return res.json({ success: true, message: 'Invitation email sent. Check your inbox and forward it to your friend.' });
  } catch (err) {
    console.error(LOG_PREFIX, err?.message || err);
    return res.status(500).json({ error: 'Failed to send invitation email. Please try again.' });
  }
}
