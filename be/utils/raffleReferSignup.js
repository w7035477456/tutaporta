import pool from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { wrapEmailHtml } from '../lib/emailHtml.js';
import { sendOutboundMail } from '../lib/outboundMail.js';
import { formatMemberDisplayCode } from './memberDisplayCode.js';
import { createTransporter, isSmtpConfigured } from './referralSignupReward.js';

const S = 'outdateddbsnapshotoct2024';
const LOG_PREFIX = '[raffleReferSignup]';
const PENDING_MAX_AGE_DAYS = 7;

export const RAFFLE_REFER_INVALID_MESSAGE =
  'Incorrect refer code. Please retry so your friend get refer credit, or leave it blank and continue';

/** 'R1234' from 'R1234' / 'r1234' / '1234'; '' for anything else (partial, other letters). */
export function normalizeRaffleReferCode(raw) {
  const m = String(raw ?? '')
    .trim()
    .toUpperCase()
    .match(/^R?(\d{4})$/);
  return m ? `R${m[1]}` : '';
}

export async function raffleReferCodeExists(code) {
  const c = normalizeRaffleReferCode(code);
  if (!c) return false;
  const { rows } = await pool.query(`SELECT 1 FROM ${S}.singles WHERE raffle_refer_code = $1 LIMIT 1`, [c]);
  return rows.length > 0;
}

/** Remember the code typed on /register until the account for this email is created. */
export async function saveRaffleReferPending(emailNorm, code) {
  const c = normalizeRaffleReferCode(code);
  const email = String(emailNorm || '').trim().toLowerCase();
  if (!c || !email) return false;
  if (!(await raffleReferCodeExists(c))) return false;
  await pool.query(
    `INSERT INTO ${S}.raffle_refer_pending (email, raffle_refer_code, created_at)
     VALUES ($1, $2, now())
     ON CONFLICT (email) DO UPDATE SET raffle_refer_code = EXCLUDED.raffle_refer_code, created_at = now()`,
    [email, c]
  );
  return true;
}

export async function clearRaffleReferPending(emailNorm) {
  const email = String(emailNorm || '').trim().toLowerCase();
  if (!email) return;
  await pool.query(`DELETE FROM ${S}.raffle_refer_pending WHERE email = $1`, [email]);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function nicknameOf(row) {
  const alias = String(row.alias || '').trim();
  if (alias) return alias;
  return formatMemberDisplayCode(row.member_id) || 'New member';
}

async function sendRaffleReferEmails({ referrer, referee, credit }) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping raffle refer emails`);
    return;
  }
  const referrerLine = `${escapeHtml(nicknameOf(referrer))} (${escapeHtml(referrer.email)})`;
  const refereeLine = `${escapeHtml(nicknameOf(referee))} (${escapeHtml(referee.email)})`;
  const html = wrapEmailHtml(
    `
      <h2 style="color:#333;">Raffle refer success</h2>
      <p style="color:#333; line-height:1.5;">
        <strong>${refereeLine}</strong> signed up for TutaMall.com with Raffle Refer Code
        <strong>${escapeHtml(referrer.raffle_refer_code)}</strong>.
      </p>
      <p style="color:#333; line-height:1.5;">
        The referer <strong>${referrerLine}</strong> has been credited.
        Total raffle refer credits: <strong>${credit}</strong>.
      </p>
      <p style="color:#333; line-height:1.5;">
        Referer: return to tutamall.com/mall and click &ldquo;Get My Raffle&rdquo; for your 2 extra raffle tickets per friend.
      </p>
      <p style="margin-top:24px; color:#666; font-size:12px;">Thank you for inviting friends to TutaMall.com.</p>
    `,
    { maxWidth: '640px' }
  );
  const transporter = createTransporter();
  for (const to of [referrer.email, referee.email]) {
    try {
      await sendOutboundMail(transporter, {
        from: OUTBOUND_EMAIL_FROM_HEADER,
        to,
        subject: 'TutaMall Raffle refer success',
        html
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} email to ${to} failed:`, err?.message || err);
    }
  }
}

/**
 * After a brand-new account is created: if its email has a pending Raffle Refer Code, link the new member
 * (singles.raffle_refer_by_code) and add 1 to the referrer's singles.raffle_refer_credit, then email both.
 * Runs once per new member; never throws (signup must not fail on this).
 */
export async function processRaffleReferSignup({ newSinglesId, email }) {
  const singlesId = Number(newSinglesId);
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!Number.isInteger(singlesId) || singlesId < 1 || !emailNorm) return false;

  const client = await pool.connect();
  let result = null;
  try {
    await client.query('BEGIN');
    const { rows: pendingRows } = await client.query(
      `DELETE FROM ${S}.raffle_refer_pending
        WHERE email = $1
        RETURNING raffle_refer_code, created_at > now() - make_interval(days => $2) AS fresh`,
      [emailNorm, PENDING_MAX_AGE_DAYS]
    );
    const pending = pendingRows[0];
    if (!pending?.fresh) {
      await client.query('COMMIT');
      return false;
    }
    const { rows: refereeRows } = await client.query(
      `UPDATE ${S}.singles SET raffle_refer_by_code = $2
        WHERE singles_id = $1 AND raffle_refer_by_code IS NULL
        RETURNING singles_id, member_id, alias, email`,
      [singlesId, pending.raffle_refer_code]
    );
    const referee = refereeRows[0];
    if (!referee) {
      await client.query('COMMIT');
      return false;
    }
    const { rows: referrerRows } = await client.query(
      `UPDATE ${S}.singles SET raffle_refer_credit = raffle_refer_credit + 1
        WHERE raffle_refer_code = $1 AND singles_id <> $2
        RETURNING singles_id, member_id, alias, email, raffle_refer_code, raffle_refer_credit`,
      [pending.raffle_refer_code, singlesId]
    );
    const referrer = referrerRows[0];
    if (!referrer) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    result = { referrer, referee };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${LOG_PREFIX} failed:`, err?.message || err);
    return false;
  } finally {
    client.release();
  }

  console.log(`${LOG_PREFIX} credited referrer singles_id=${result.referrer.singles_id} for new singles_id=${singlesId}`);
  await sendRaffleReferEmails({ ...result, credit: Number(result.referrer.raffle_refer_credit) }).catch((err) =>
    console.error(`${LOG_PREFIX} email failed:`, err?.message || err)
  );
  return true;
}

/** GET /api/raffle/refer-code/validate?code=R1234 → { valid } (public; used on /register). */
export async function getRaffleReferCodeValidate(req, res) {
  try {
    const valid = await raffleReferCodeExists(req.query?.code);
    return res.json({ valid, message: valid ? '' : RAFFLE_REFER_INVALID_MESSAGE });
  } catch (err) {
    console.error(`${LOG_PREFIX} validate failed:`, err?.message || err);
    return res.status(500).json({ error: 'Could not check the refer code. Please try again.' });
  }
}
