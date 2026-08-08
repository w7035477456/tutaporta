import nodemailer from 'nodemailer';
import pool, { getDBSchema } from '../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../lib/emailHtml.js';
import { formatMemberDisplayCode } from './memberDisplayCode.js';
import { DEFAULT_REFER_BY_CODE, isRewardEligibleReferByCode } from './referByCode.js';
import { formatUserDateTime } from './userTimeZone.js';

const LOG_PREFIX = '[referralSignupReward]';
const REWARD_TOKENS = 1;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanNullableText(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text ? text : null;
}

function pickColumn(existingColumns, candidates) {
  for (const candidate of candidates) {
    if (existingColumns.has(candidate)) return candidate;
  }
  return null;
}

function sqlIdent(columnName) {
  const raw = String(columnName || '').trim();
  if (!raw) return raw;
  if (/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

async function getTableColumns(client, tableName) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, tableName]
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
}

function randomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function makePaymentTransactionIdBigInt(paymentId) {
  const id = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(id) || id < 1) return null;
  const prefix = String(randomIntInclusive(1, 99)).padStart(2, '0');
  const suffix = String(id % 1_000_000).padStart(6, '0');
  const combined = `${prefix}${suffix}`;
  const n = Number(combined);
  return Number.isFinite(n) ? n : null;
}

async function ensurePaymentTransactionId(client, paymentColumns, paymentId) {
  const paymentIdColumn = pickColumn(paymentColumns, ['payment_id']);
  const transactionIdColumn = pickColumn(paymentColumns, ['transactionId', 'transaction_id']);
  if (!paymentIdColumn || !transactionIdColumn) return null;
  const pid = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(pid) || pid < 1) return null;

  const paymentIdSql = sqlIdent(paymentIdColumn);
  const transactionIdSql = sqlIdent(transactionIdColumn);

  const existing = await client.query(
    `SELECT ${transactionIdSql} AS transaction_id
     FROM helloworldjunktest.payment
     WHERE ${paymentIdSql} = $1
     LIMIT 1`,
    [pid]
  );
  const current = existing.rows[0]?.transaction_id;
  if (current != null && String(current).trim() !== '') {
    const n = Number(current);
    return Number.isFinite(n) ? n : null;
  }

  const nextId = makePaymentTransactionIdBigInt(pid);
  if (!nextId) return null;
  await client.query(
    `UPDATE helloworldjunktest.payment
     SET ${transactionIdSql} = $1
     WHERE ${paymentIdSql} = $2`,
    [nextId, pid]
  );
  return nextId;
}

function formatRewardDateTime(date = new Date(), profile = {}) {
  return formatUserDateTime(date, {
    zip: profile.zip ?? profile.mailing_zip ?? null,
    phone: profile.phone ?? null,
    style: 'short'
  });
}

export function buildReferrerRewardDescription(newMemberId, when = new Date(), profile = {}) {
  const memberLabel = formatMemberDisplayCode(newMemberId) || `M${String(newMemberId).padStart(6, '0')}`;
  const whenText = formatRewardDateTime(when, profile);
  return `Referer reward, 1 token from ${memberLabel} successful signed up ${whenText}. Congratulations.`;
}

export function buildRefereeRewardDescription(referrerMemberId, when = new Date(), profile = {}) {
  const referrerLabel =
    formatMemberDisplayCode(referrerMemberId) || `M${String(referrerMemberId).padStart(6, '0')}`;
  const whenText = formatRewardDateTime(when, profile);
  return `Referee reward, 1 token for signing up with valid referer code by ${referrerLabel} on ${whenText}. Congratulations.`;
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

/** Person who owns my_refer_code matching refer_by_code on the new signup. */
async function findReferrerByReferCode(client, referByCode, excludeSinglesId) {
  const code = cleanNullableText(referByCode);
  if (!isRewardEligibleReferByCode(code)) return null;

  const { rows } = await client.query(
    `SELECT singles_id, member_id, email, alias, mailing_zip, phone, my_refer_code
     FROM helloworldjunktest.singles
     WHERE my_refer_code = $1
       AND singles_id <> $2
     LIMIT 1`,
    [code, excludeSinglesId]
  );
  const row = rows[0];
  if (!row) return null;
  if (cleanNullableText(row.my_refer_code) !== code) return null;
  return row;
}

async function loadReferByCodeForSingles(client, singlesId) {
  const { rows } = await client.query(
    `SELECT refer_by_code
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return cleanNullableText(rows[0]?.refer_by_code);
}

async function paymentDescriptionExists(client, singlesId, markerPattern) {
  const paymentColumns = await getTableColumns(client, 'payment');
  const descriptionColumn = pickColumn(paymentColumns, [
    'transaction_description',
    'transaction_descripition',
    'payment_history',
    'description'
  ]);
  if (!descriptionColumn) return false;

  const descriptionSql = sqlIdent(descriptionColumn);
  const { rows } = await client.query(
    `SELECT payment_id
     FROM helloworldjunktest.payment
     WHERE singles_id = $1
       AND COALESCE(${descriptionSql}, '') ILIKE $2
     LIMIT 1`,
    [singlesId, markerPattern]
  );
  return rows.length > 0;
}

async function referrerRewardAlreadyApplied(client, referrerSinglesId, newMemberLabel) {
  return paymentDescriptionExists(client, referrerSinglesId, `%from ${newMemberLabel} successful signed up%`);
}

async function refereeRewardAlreadyApplied(client, newSinglesId, referrerMemberLabel) {
  return paymentDescriptionExists(
    client,
    newSinglesId,
    `%referer code by ${referrerMemberLabel}%`
  );
}

async function creditTokenReward(client, { singlesId, description }) {
  const paymentColumns = await getTableColumns(client, 'payment');
  const singlesColumns = await getTableColumns(client, 'singles');

  const latestPaymentResult = await client.query(
    `SELECT payment_id, account_balance_token, paid_total_dollar, token_add_or_debit
     FROM helloworldjunktest.payment
     WHERE singles_id = $1
     ORDER BY payment_id DESC
     LIMIT 1`,
    [singlesId]
  );
  const latestPayment = latestPaymentResult.rows[0] || {};
  const prevBalance = toFiniteNumber(latestPayment?.account_balance_token, 0);
  const prevPaidDollar = toFiniteNumber(latestPayment?.paid_total_dollar, 0);
  const prevPaidToken = toFiniteNumber(latestPayment?.token_add_or_debit, 0);
  const nextBalance = prevBalance + REWARD_TOKENS;
  const nextPaidToken = prevPaidToken + REWARD_TOKENS;
  const now = new Date();

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];
  const pushIfExists = (column, value) => {
    if (!paymentColumns.has(column) || insertColumns.includes(column)) return;
    insertColumns.push(column);
    insertValues.push(value);
    placeholders.push(`$${insertValues.length}`);
  };

  pushIfExists('singles_id', singlesId);
  const descriptionColumn = pickColumn(paymentColumns, [
    'transaction_description',
    'transaction_descripition',
    'payment_history',
    'description'
  ]);
  if (descriptionColumn) {
    pushIfExists(descriptionColumn, description);
  }
  pushIfExists('account_balance_token', nextBalance);
  pushIfExists('paid_total_dollar', prevPaidDollar);
  pushIfExists('token_add_or_debit', nextPaidToken);
  pushIfExists('transaction_date_time', now);
  pushIfExists('last_paid_date', now);
  if (paymentColumns.has('created_at')) {
    insertColumns.push('created_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }
  if (paymentColumns.has('updated_at')) {
    insertColumns.push('updated_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }

  if (!insertColumns.length) {
    throw new Error('payment table has no writable columns');
  }

  const inserted = await client.query(
    `INSERT INTO helloworldjunktest.payment (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING payment_id`,
    insertValues
  );
  const paymentId = Number(inserted.rows[0]?.payment_id);
  const transactionId = await ensurePaymentTransactionId(client, paymentColumns, paymentId);

  if (Number.isFinite(paymentId) && paymentId > 0 && singlesColumns.has('payment_id_fk')) {
    const updates = ['payment_id_fk = $1'];
    if (singlesColumns.has('updated_at')) updates.push('updated_at = CURRENT_TIMESTAMP');
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $2`,
      [paymentId, singlesId]
    );
  }

  return { paymentId, transactionId, nextBalance };
}

async function sendReferrerRewardEmail({ referrerEmail, description, transactionId, nextBalance }) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping referrer reward email`);
    return;
  }

  const txnLabel = transactionId != null ? String(transactionId) : '';
  const html = wrapEmailHtml(
    `
      <h2 style="color:#333;">Referral reward credited</h2>
      <p style="color:#333; line-height:1.5;">${description}</p>
      <p style="color:#333; line-height:1.5;">
        Your updated token balance is <strong>${nextBalance}</strong>.
        ${txnLabel ? ` Transaction ID: <strong>${txnLabel}</strong>.` : ''}
      </p>
      <p style="margin-top:24px; color:#666; font-size:12px;">Thank you for inviting friends to OnlineMall.Website.</p>
    `,
    { maxWidth: '640px' }
  );

  const transporter = createTransporter();
  await transporter.sendMail(
    enrichMailOptions({
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: referrerEmail,
      subject: 'Referral reward: +1 token',
      html
    })
  );
}

async function sendRefereeRewardEmail({ newMemberEmail, description, transactionId, nextBalance }) {
  if (!isSmtpConfigured()) {
    console.warn(`${LOG_PREFIX} SMTP not configured; skipping referee reward email`);
    return;
  }

  const txnLabel = transactionId != null ? String(transactionId) : '';
  const html = wrapEmailHtml(
    `
      <h2 style="color:#333;">Welcome reward credited</h2>
      <p style="color:#333; line-height:1.5;">${description}</p>
      <p style="color:#333; line-height:1.5;">
        Your updated token balance is <strong>${nextBalance}</strong>.
        ${txnLabel ? ` Transaction ID: <strong>${txnLabel}</strong>.` : ''}
      </p>
      <p style="margin-top:24px; color:#666; font-size:12px;">Thank you for joining OnlineMall.Website.</p>
    `,
    { maxWidth: '640px' }
  );

  const transporter = createTransporter();
  await transporter.sendMail(
    enrichMailOptions({
      from: OUTBOUND_EMAIL_FROM_HEADER,
      to: newMemberEmail,
      subject: 'Welcome reward: +1 token',
      html
    })
  );
}

/**
 * Credit referrer + new signup (referee) after registration completes.
 * @returns {Promise<boolean>} true when at least one reward row was inserted
 */
export async function processReferralSignupReward({
  newSinglesId,
  newMemberId,
  newMemberEmail,
  referByCode,
  isNewAccount = true
}) {
  if (!isNewAccount) return false;

  const newSinglesIdNum = Math.trunc(toFiniteNumber(newSinglesId, 0));
  const newMemberIdNum = Math.trunc(toFiniteNumber(newMemberId, 0));
  const emailNorm = cleanNullableText(newMemberEmail)?.toLowerCase();
  const code = cleanNullableText(referByCode);

  if (
    !Number.isFinite(newSinglesIdNum) ||
    newSinglesIdNum < 1 ||
    !Number.isFinite(newMemberIdNum) ||
    newMemberIdNum < 1 ||
    !emailNorm
  ) {
    return false;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const dbReferByCode = await loadReferByCodeForSingles(client, newSinglesIdNum);
    const effectiveCode = cleanNullableText(dbReferByCode) || code;
    if (!isRewardEligibleReferByCode(effectiveCode)) {
      await client.query('ROLLBACK');
      console.log(`${LOG_PREFIX} skip no-referrer refer_by_code`, {
        newSinglesId: newSinglesIdNum,
        effectiveCode: effectiveCode || DEFAULT_REFER_BY_CODE
      });
      return false;
    }

  const newMemberLabel = formatMemberDisplayCode(newMemberIdNum) || `M${String(newMemberIdNum).padStart(6, '0')}`;

    const referrer = await findReferrerByReferCode(client, effectiveCode, newSinglesIdNum);
    if (!referrer) {
      await client.query('ROLLBACK');
      console.log(`${LOG_PREFIX} no referrer for refer_by_code=${effectiveCode}`);
      return false;
    }

    const referrerSinglesId = Number(referrer.singles_id);
    const referrerMemberId = Math.trunc(toFiniteNumber(referrer.member_id, 0));
    const referrerEmail = cleanNullableText(referrer.email)?.toLowerCase();
    const referrerMemberLabel =
      formatMemberDisplayCode(referrerMemberId) || `M${String(referrerMemberId).padStart(6, '0')}`;

    if (!referrerEmail) {
      await client.query('ROLLBACK');
      console.warn(`${LOG_PREFIX} referrer singles_id=${referrerSinglesId} has no email`);
      return false;
    }

    const referrerAlready = await referrerRewardAlreadyApplied(client, referrerSinglesId, newMemberLabel);
    const refereeAlready = await refereeRewardAlreadyApplied(client, newSinglesIdNum, referrerMemberLabel);

    if (referrerAlready && refereeAlready) {
      await client.query('ROLLBACK');
      console.log(`${LOG_PREFIX} rewards already applied for ${newMemberLabel} <-> referrer ${referrerSinglesId}`);
      return false;
    }

    const rewardWhen = new Date();
    const referrerTimeZoneProfile = {
      zip: cleanNullableText(referrer.mailing_zip),
      phone: cleanNullableText(referrer.phone)
    };
    const refereeTimeZoneProfile = await (async () => {
      const { rows } = await client.query(
        `SELECT mailing_zip, phone
         FROM helloworldjunktest.singles
         WHERE singles_id = $1
         LIMIT 1`,
        [newSinglesIdNum]
      );
      return {
        zip: cleanNullableText(rows[0]?.mailing_zip),
        phone: cleanNullableText(rows[0]?.phone)
      };
    })();
    let referrerCredit = null;
    let refereeCredit = null;

    if (!referrerAlready) {
      referrerCredit = await creditTokenReward(client, {
        singlesId: referrerSinglesId,
        description: buildReferrerRewardDescription(newMemberIdNum, rewardWhen, referrerTimeZoneProfile)
      });
    }

    if (!refereeAlready) {
      refereeCredit = await creditTokenReward(client, {
        singlesId: newSinglesIdNum,
        description: buildRefereeRewardDescription(referrerMemberId, rewardWhen, refereeTimeZoneProfile)
      });
    }

    await client.query('COMMIT');

    if (referrerCredit) {
      console.log(`${LOG_PREFIX} credited +${REWARD_TOKENS} token to referrer singles_id=${referrerSinglesId}`, {
        newSinglesId: newSinglesIdNum,
        newMemberLabel,
        paymentTxn: referrerCredit.transactionId
      });
      try {
        await sendReferrerRewardEmail({
          referrerEmail,
          description: buildReferrerRewardDescription(newMemberIdNum, rewardWhen, referrerTimeZoneProfile),
          transactionId: referrerCredit.transactionId,
          nextBalance: referrerCredit.nextBalance
        });
      } catch (mailErr) {
        console.error(`${LOG_PREFIX} referrer email failed:`, mailErr?.message || mailErr);
      }
    }

    if (refereeCredit) {
      console.log(`${LOG_PREFIX} credited +${REWARD_TOKENS} token to new signup singles_id=${newSinglesIdNum}`, {
        referrerSinglesId,
        referrerMemberLabel,
        paymentTxn: refereeCredit.transactionId
      });
      try {
        await sendRefereeRewardEmail({
          newMemberEmail: emailNorm,
          description: buildRefereeRewardDescription(referrerMemberId, rewardWhen, refereeTimeZoneProfile),
          transactionId: refereeCredit.transactionId,
          nextBalance: refereeCredit.nextBalance
        });
      } catch (mailErr) {
        console.error(`${LOG_PREFIX} referee email failed:`, mailErr?.message || mailErr);
      }
    }

    return Boolean(referrerCredit || refereeCredit);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error(`${LOG_PREFIX} failed:`, err?.message || err);
    return false;
  } finally {
    client.release();
  }
}
