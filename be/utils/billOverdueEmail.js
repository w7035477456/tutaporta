/**
 * Daily Bill Schedule overdue digest email.
 *
 * Rules (product):
 * - If the user has any monthly and/or yearly overdue Manual bills, send ONE email that day.
 * - Email shows Monthly + Yearly tables with overdue rows only.
 * - Keep sending daily until no overdue items remain.
 * - At most one email per user per calendar day (bill_overdue_email_log).
 *
 * Env (~/.ssh/be/.env):
 *   BILL_OVERDUE_EMAIL=true          — master switch (default true when unset)
 *   BILL_OVERDUE_EMAIL_AT=8          — local hour 0–23 (default 8). 24 = midnight.
 */

import nodemailer from 'nodemailer';
import pool from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../lib/emailHtml.js';
import { getPublicAppUrl } from './publicAppUrl.js';

const LOG = '[bill-overdue-email]';
const ADVISORY_LOCK_KEY = 872314001;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let refreshTimer = null;
let runInFlight = null;

function envFlagTrue(name, defaultTrue = true) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultTrue;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

export function isBillOverdueEmailEnabled() {
  return envFlagTrue('BILL_OVERDUE_EMAIL', true);
}

/** Local hour 0–23; 24 treated as 0 (midnight). */
export function getBillOverdueEmailAtHour() {
  const n = Number(String(process.env.BILL_OVERDUE_EMAIL_AT ?? '8').trim());
  if (!Number.isFinite(n)) return 8;
  const h = Math.trunc(n);
  if (h === 24) return 0;
  return Math.min(23, Math.max(0, h));
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayYmdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function msUntilNextScheduledRun() {
  const targetHour = getBillOverdueEmailAtHour();
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * Monthly overdue: Manual, not Paid, due (bill_year, bill_month, due_day) < today (local date).
 */
async function loadMonthlyOverdueByUser(client, asOfDate) {
  const { rows } = await client.query(
    `
    SELECT
      mb.singles_id,
      mb.monthly_bill_id,
      mb.bill_year,
      mb.bill_month,
      mb.row_index,
      mb.bill_description,
      mb.due_day,
      mb.amount,
      mb.bill_type,
      mb.action
    FROM helloworldjunktest.monthly_bill mb
    WHERE mb.bill_type = 'Manual'
      AND (mb.action IS DISTINCT FROM 'Paid')
      AND mb.due_day IS NOT NULL
      AND mb.due_day BETWEEN 1 AND 31
      AND (
        (make_date(mb.bill_year, mb.bill_month, 1)
          + ((mb.due_day - 1) * interval '1 day'))::date
        < $1::date
      )
    ORDER BY mb.singles_id, mb.bill_year, mb.bill_month, mb.row_index
    `,
    [asOfDate]
  );
  return rows;
}

/**
 * Yearly overdue: Manual, not Paid, due (bill_year, bill_month, due_month_day) < today.
 */
async function loadYearlyOverdueByUser(client, asOfDate) {
  const { rows } = await client.query(
    `
    SELECT
      yb.singles_id,
      yb.yearly_bill_id,
      yb.bill_year,
      yb.bill_month,
      yb.row_index,
      yb.bill_description,
      yb.due_month_day,
      yb.amount,
      yb.bill_type,
      yb.action
    FROM helloworldjunktest.yearly_bill yb
    WHERE yb.bill_type = 'Manual'
      AND (yb.action IS DISTINCT FROM 'Paid')
      AND yb.bill_month IS NOT NULL
      AND yb.due_month_day IS NOT NULL
      AND yb.bill_month BETWEEN 1 AND 12
      AND yb.due_month_day BETWEEN 1 AND 31
      AND (
        (make_date(yb.bill_year, yb.bill_month, 1)
          + ((yb.due_month_day - 1) * interval '1 day'))::date
        < $1::date
      )
    ORDER BY yb.singles_id, yb.bill_year, yb.bill_month, yb.row_index
    `,
    [asOfDate]
  );
  return rows;
}

function formatMonthlyDue(row) {
  const m = Number(row.bill_month);
  const d = Number(row.due_day);
  const y = Number(row.bill_year);
  const mon = MONTH_SHORT[m - 1] || String(m);
  return `${mon} ${d}, ${y}`;
}

function formatYearlyDue(row) {
  const m = Number(row.bill_month);
  const d = Number(row.due_month_day);
  const y = Number(row.bill_year);
  const mon = MONTH_SHORT[m - 1] || String(m);
  return `${mon} ${d}, ${y}`;
}

function buildTableHtml(title, headers, bodyRows) {
  if (!bodyRows.length) {
    return `<h2 style="margin:24px 0 8px;font-size:18px;">${escapeHtml(title)}</h2>
<p style="margin:0 0 16px;color:#555;">No overdue items.</p>`;
  }
  const head = headers.map((h) => `<th style="border:1px solid #000;padding:6px 8px;background:#e8e8e8;text-align:left;">${escapeHtml(h)}</th>`).join('');
  const body = bodyRows
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (c, i) =>
              `<td style="border:1px solid #000;padding:6px 8px;${i === cells.length - 1 ? 'background:#e74c3c;color:#fff;font-weight:700;' : ''}">${c}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<h2 style="margin:24px 0 8px;font-size:18px;">${escapeHtml(title)}</h2>
<table style="border-collapse:collapse;width:100%;max-width:720px;font-size:14px;">
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function buildEmailHtml({ alias, monthlyRows, yearlyRows, appUrl }) {
  const monthlyBody = monthlyRows.map((r) => [
    escapeHtml(r.row_index),
    escapeHtml(r.bill_description || ''),
    escapeHtml(formatMonthlyDue(r)),
    escapeHtml(r.amount || ''),
    escapeHtml(r.bill_type || 'Manual'),
    escapeHtml(r.action || 'Not Paid'),
    'Over Due'
  ]);
  const yearlyBody = yearlyRows.map((r) => [
    escapeHtml(r.row_index),
    escapeHtml(r.bill_description || ''),
    escapeHtml(formatYearlyDue(r)),
    escapeHtml(r.amount || ''),
    escapeHtml(r.bill_type || 'Manual'),
    escapeHtml(r.action || 'Not Paid'),
    'Over Due'
  ]);
  const headers = ['#', 'Bill Description', 'Due Date', 'Amount', 'Type', 'Action', 'Status'];
  const greeting = alias ? `Hi ${escapeHtml(alias)},` : 'Hi,';
  // Inner body only — wrapEmailHtml adds logo + container
  return `<p>${greeting}</p>
<p>You have overdue bill(s) on your TutaNotes <strong>Bill Schedule</strong>. This reminder is sent once per day until all overdue items are cleared.</p>
${buildTableHtml('Monthly — Overdue only', headers, monthlyBody)}
${buildTableHtml('Yearly — Overdue only', headers, yearlyBody)}
<p style="margin-top:24px;">Open Bill Schedule: <a href="${escapeHtml(appUrl)}/myNote">${escapeHtml(appUrl)}/myNote</a></p>
<p style="color:#666;font-size:12px;">OnlineMall.Website — Bill Schedule overdue digest</p>`;
}

function buildEmailPlain({ alias, monthlyRows, yearlyRows, appUrl }) {
  const lines = [
    alias ? `Hi ${alias},` : 'Hi,',
    '',
    'You have overdue bill(s) on your TutaNotes Bill Schedule.',
    'This reminder is sent once per day until all overdue items are cleared.',
    '',
    '--- Monthly overdue ---'
  ];
  if (!monthlyRows.length) lines.push('(none)');
  else {
    for (const r of monthlyRows) {
      lines.push(
        `#${r.row_index} ${r.bill_description || ''} | due ${formatMonthlyDue(r)} | ${r.amount || ''} | ${r.action || 'Not Paid'} | Over Due`
      );
    }
  }
  lines.push('', '--- Yearly overdue ---');
  if (!yearlyRows.length) lines.push('(none)');
  else {
    for (const r of yearlyRows) {
      lines.push(
        `#${r.row_index} ${r.bill_description || ''} | due ${formatYearlyDue(r)} | ${r.amount || ''} | ${r.action || 'Not Paid'} | Over Due`
      );
    }
  }
  lines.push('', `Open: ${appUrl}/myNote`);
  return lines.join('\n');
}

async function claimSendSlot(client, singlesId, sentOn, monthlyCount, yearlyCount) {
  const { rows } = await client.query(
    `
    INSERT INTO helloworldjunktest.bill_overdue_email_log
      (singles_id, sent_on, monthly_overdue_count, yearly_overdue_count)
    VALUES ($1, $2::date, $3, $4)
    ON CONFLICT (singles_id, sent_on) DO NOTHING
    RETURNING singles_id
    `,
    [singlesId, sentOn, monthlyCount, yearlyCount]
  );
  return rows.length > 0;
}

async function releaseSendSlot(client, singlesId, sentOn) {
  await client.query(
    `DELETE FROM helloworldjunktest.bill_overdue_email_log
      WHERE singles_id = $1 AND sent_on = $2::date`,
    [singlesId, sentOn]
  );
}

async function loadUserEmail(client, singlesId) {
  const { rows } = await client.query(
    `SELECT singles_id, email, alias
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [singlesId]
  );
  return rows[0] || null;
}

/**
 * One daily run: email each user who has overdue monthly and/or yearly rows (max 1 email/user/day).
 */
export async function runBillOverdueEmailDigest() {
  if (!isBillOverdueEmailEnabled()) {
    console.log(`${LOG} skipped (BILL_OVERDUE_EMAIL disabled)`);
    return { ok: true, skipped: true, reason: 'disabled' };
  }
  if (!isSmtpConfigured()) {
    console.warn(`${LOG} skipped (SMTP not configured)`);
    return { ok: false, skipped: true, reason: 'smtp' };
  }

  const asOfDate = todayYmdLocal();
  const client = await pool.connect();
  let locked = false;
  try {
    const lockRes = await client.query(`SELECT pg_try_advisory_lock($1) AS ok`, [ADVISORY_LOCK_KEY]);
    locked = Boolean(lockRes.rows[0]?.ok);
    if (!locked) {
      console.log(`${LOG} another worker holds the advisory lock — skip`);
      return { ok: true, skipped: true, reason: 'lock' };
    }

    const monthlyRows = await loadMonthlyOverdueByUser(client, asOfDate).catch((err) => {
      console.warn(`${LOG} monthly query failed:`, err?.message ?? err);
      return [];
    });
    const yearlyRows = await loadYearlyOverdueByUser(client, asOfDate).catch((err) => {
      console.warn(`${LOG} yearly query failed:`, err?.message ?? err);
      return [];
    });

    const byUser = new Map();
    for (const r of monthlyRows) {
      const id = Number(r.singles_id);
      if (!byUser.has(id)) byUser.set(id, { monthly: [], yearly: [] });
      byUser.get(id).monthly.push(r);
    }
    for (const r of yearlyRows) {
      const id = Number(r.singles_id);
      if (!byUser.has(id)) byUser.set(id, { monthly: [], yearly: [] });
      byUser.get(id).yearly.push(r);
    }

    if (byUser.size === 0) {
      console.log(`${LOG} no overdue bills for ${asOfDate}`);
      return { ok: true, sent: 0, asOfDate };
    }

    const transporter = createTransporter();
    const appUrl = getPublicAppUrl() || 'https://onlinemall.website';
    let sent = 0;
    let failed = 0;

    for (const [singlesId, buckets] of byUser) {
      const claimed = await claimSendSlot(
        client,
        singlesId,
        asOfDate,
        buckets.monthly.length,
        buckets.yearly.length
      );
      if (!claimed) continue;

      const user = await loadUserEmail(client, singlesId);
      const toEmail = String(user?.email ?? '').trim().toLowerCase();
      if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        console.warn(`${LOG} singles_id=${singlesId} has no valid email — releasing slot`);
        await releaseSendSlot(client, singlesId, asOfDate);
        failed += 1;
        continue;
      }

      const payload = {
        alias: user?.alias || '',
        monthlyRows: buckets.monthly,
        yearlyRows: buckets.yearly,
        appUrl
      };
      try {
        const mail = enrichMailOptions({
          from: OUTBOUND_EMAIL_FROM_HEADER,
          to: toEmail,
          subject: `Bill Schedule overdue reminder (${asOfDate})`,
          text: buildEmailPlain(payload),
          html: wrapEmailHtml(buildEmailHtml(payload), { maxWidth: '720px' })
        });
        await transporter.sendMail(mail);
        sent += 1;
        console.log(
          `${LOG} sent to singles_id=${singlesId} monthly=${buckets.monthly.length} yearly=${buckets.yearly.length}`
        );
      } catch (err) {
        failed += 1;
        console.error(`${LOG} send failed singles_id=${singlesId}:`, err?.message ?? err);
        await releaseSendSlot(client, singlesId, asOfDate);
      }
    }

    return { ok: true, sent, failed, users: byUser.size, asOfDate };
  } finally {
    if (locked) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]);
      } catch {
        // ignore
      }
    }
    client.release();
  }
}

export function runBillOverdueEmailDigestNow() {
  if (runInFlight) return runInFlight;
  runInFlight = runBillOverdueEmailDigest().finally(() => {
    runInFlight = null;
  });
  return runInFlight;
}

function scheduleNextDailyRun() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!isBillOverdueEmailEnabled()) {
    console.log(`${LOG} scheduler not started (BILL_OVERDUE_EMAIL disabled)`);
    return;
  }
  const delayMs = msUntilNextScheduledRun();
  refreshTimer = setTimeout(() => {
    void (async () => {
      try {
        await runBillOverdueEmailDigestNow();
      } catch (err) {
        console.error(`${LOG} scheduled run failed:`, err?.message ?? err);
      }
      scheduleNextDailyRun();
    })();
  }, delayMs);
  refreshTimer.unref?.();
  const nextAt = new Date(Date.now() + delayMs).toISOString();
  console.log(
    `${LOG} scheduled daily at BILL_OVERDUE_EMAIL_AT=${getBillOverdueEmailAtHour()} local (next ~${nextAt})`
  );
}

export function startBillOverdueEmailDaily() {
  scheduleNextDailyRun();
}
