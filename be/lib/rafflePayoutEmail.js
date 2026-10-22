import nodemailer from 'nodemailer';
import pool from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from './emailFrom.js';
import { wrapEmailHtml } from './emailHtml.js';
import { sendOutboundMail } from './outboundMail.js';
import { formatMemberDisplayCode } from '../utils/memberDisplayCode.js';

const S = 'outdateddbsnapshotoct2024';
const DEFAULT_RAFFLE_EMAIL_TO = 'raffle@tutamall.com';
const LOG_PREFIX = '[rafflePayoutEmail]';

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
  return Boolean(smtpUser && smtpPass && smtpUser !== 'your-email@gmail.com' && smtpPass !== 'your-app-password');
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') }
  });
}

export function getRafflePayoutEmailTo() {
  return String(process.env.RAFFLE_PAYOUT_EMAIL_TO ?? '').trim() || DEFAULT_RAFFLE_EMAIL_TO;
}

function formatWhen(value, timeZone) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleString('en-US', { timeZone: timeZone || 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return d.toISOString();
  }
}

function formatVerifyCode(code) {
  const c = String(code || '');
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

async function loadRafflePayoutReport(raffleUserId) {
  const { rows } = await pool.query(
    `SELECT e.event_id, e.event_title, e.event_night_datetime, e.event_build_n_address, e.event_time_zone,
            h.host_full_name, h.host_email, h.host_phone,
            u.raffle_number, u.raffle_generated_id, u.raffle_claimed_datetime, u.paypal_info, u.venmo_info,
            s.singles_id, s.email, s.member_id, s.alias,
            COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', s.mailing_firstname, s.mailing_lastname)), ''),
                     NULLIF(BTRIM(CONCAT_WS(' ', s.dl_firstname, s.dl_lastname)), '')) AS fullname
       FROM ${S}.raffle_user u
       JOIN ${S}.raffle_event e ON e.event_id = u.event_id
       JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
       JOIN ${S}.singles s ON s.singles_id = u.singles_id
      WHERE u.raffle_user_id = $1`,
    [raffleUserId]
  );
  const report = rows[0];
  if (!report) return null;

  const [{ rows: countRows }, { rows: draws }] = await Promise.all([
    pool.query(
      `SELECT count(DISTINCT singles_id)::int AS unique_users, count(*)::int AS total_raffles
         FROM ${S}.raffle_user WHERE event_id = $1 AND raffle_number IS NOT NULL`,
      [report.event_id]
    ),
    pool.query(
      `SELECT d.raffle_number, d.raffle_draw_datetime, d.raffle_user_id, s.alias, s.member_id
         FROM ${S}.raffle_draw d
         LEFT JOIN ${S}.raffle_user u ON u.raffle_user_id = d.raffle_user_id
         LEFT JOIN ${S}.singles s ON s.singles_id = u.singles_id
        WHERE d.event_id = $1
        ORDER BY d.raffle_draw_datetime, d.raffle_draw_id`,
      [report.event_id]
    )
  ]);
  return { ...report, counts: countRows[0] || { unique_users: 0, total_raffles: 0 }, draws };
}

function buildEmail(r, raffleUserId) {
  const tz = r.event_time_zone;
  const memberCode = formatMemberDisplayCode(r.member_id) || '—';
  const payout = r.paypal_info ? `PayPal: ${r.paypal_info}` : r.venmo_info ? `Venmo: ${r.venmo_info}` : '—';
  const row = (label, value) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;
  const section = (title) => `<h3 style="margin:20px 0 6px;color:#333;">${escapeHtml(title)}</h3>`;

  const drawLines = r.draws.map((d, i) => {
    const holder =
      d.raffle_user_id == null
        ? 'no ticket'
        : `${d.alias || 'member'} (${formatMemberDisplayCode(d.member_id) || '—'})${Number(d.raffle_user_id) === Number(raffleUserId) ? ' — WINNER' : ''}`;
    return { n: i + 1, number: d.raffle_number, when: formatWhen(d.raffle_draw_datetime, tz), holder };
  });
  const drawsHtml = drawLines.length
    ? `<table style="border-collapse:collapse;font-size:14px;">
        <tr><th style="text-align:left;padding:4px 12px 4px 0;">#</th><th style="text-align:left;padding:4px 12px 4px 0;">Number</th><th style="text-align:left;padding:4px 12px 4px 0;">Drawn at</th><th style="text-align:left;padding:4px 0;">Ticket holder</th></tr>
        ${drawLines
          .map(
            (d) =>
              `<tr><td style="padding:4px 12px 4px 0;">${d.n}</td><td style="padding:4px 12px 4px 0;font-weight:bold;">${escapeHtml(d.number)}</td><td style="padding:4px 12px 4px 0;">${escapeHtml(d.when)}</td><td style="padding:4px 0;">${escapeHtml(d.holder)}</td></tr>`
          )
          .join('')}
      </table>`
    : '<p style="margin:0;">No draws recorded.</p>';

  const subject = `Raffle prize claim — ${r.event_title} — #${r.raffle_number} — ${payout}`;
  const html = wrapEmailHtml(`
    <h2 style="color:#333;margin-top:0;">Raffle prize claim submitted</h2>
    ${section('Event')}
    <table style="border-collapse:collapse;font-size:14px;">
      ${row('Event', r.event_title)}
      ${row('Date', formatWhen(r.event_night_datetime, tz))}
      ${row('Address', r.event_build_n_address || '—')}
      ${row('Host', r.host_full_name || '—')}
    </table>
    ${section('Winner')}
    <table style="border-collapse:collapse;font-size:14px;">
      ${row('Winning number', r.raffle_number)}
      ${row('Verification code', formatVerifyCode(r.raffle_generated_id))}
      ${row('Winner email', r.email || '—')}
      ${row('Member number', memberCode)}
      ${row('Nickname', r.alias || '—')}
      ${row('Full name', r.fullname || '—')}
      ${row('Host verified', formatWhen(r.raffle_claimed_datetime, tz))}
      ${row('Pay to', payout)}
    </table>
    ${section('Raffles generated')}
    <table style="border-collapse:collapse;font-size:14px;">
      ${row('Unique members', r.counts.unique_users)}
      ${row('Total raffles', r.counts.total_raffles)}
    </table>
    ${section(`Numbers drawn by host (${drawLines.length})`)}
    ${drawsHtml}
  `);

  const text = [
    'Raffle prize claim submitted',
    '',
    `Event: ${r.event_title}`,
    `Date: ${formatWhen(r.event_night_datetime, tz)}`,
    `Address: ${r.event_build_n_address || '—'}`,
    `Host: ${r.host_full_name || '—'}`,
    '',
    `Winning number: ${r.raffle_number}`,
    `Verification code: ${formatVerifyCode(r.raffle_generated_id)}`,
    `Winner email: ${r.email || '—'}`,
    `Member number: ${memberCode}`,
    `Nickname: ${r.alias || '—'}`,
    `Full name: ${r.fullname || '—'}`,
    `Host verified: ${formatWhen(r.raffle_claimed_datetime, tz)}`,
    `Pay to: ${payout}`,
    '',
    `Raffles generated — unique members: ${r.counts.unique_users}, total raffles: ${r.counts.total_raffles}`,
    '',
    `Numbers drawn by host (${drawLines.length}):`,
    ...(drawLines.length ? drawLines.map((d) => `  ${d.n}. #${d.number}  ${d.when}  ${d.holder}`) : ['  No draws recorded.'])
  ].join('\n');

  return { subject, html, text, replyTo: r.email || undefined };
}

export async function buildRafflePayoutEmail(raffleUserId) {
  const report = await loadRafflePayoutReport(raffleUserId);
  return report ? buildEmail(report, raffleUserId) : null;
}

/** Winner submitted PayPal / Venmo → full event + winner + draw history report to raffle@tutamall.com. */
export async function sendRafflePayoutEmail(raffleUserId) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping`);
    return { sent: false, skipped: true };
  }
  const email = await buildRafflePayoutEmail(raffleUserId);
  if (!email) return { sent: false, skipped: true };
  const { subject, html, text, replyTo } = email;
  const to = getRafflePayoutEmailTo();
  await sendOutboundMail(createTransporter(), { from: OUTBOUND_EMAIL_FROM_HEADER, to, replyTo, subject, html, text });
  return { sent: true, to };
}

export function sendRafflePayoutEmailFireAndForget(raffleUserId) {
  sendRafflePayoutEmail(raffleUserId).catch((err) => console.error(`${LOG_PREFIX} send failed:`, err?.message || err));
}
