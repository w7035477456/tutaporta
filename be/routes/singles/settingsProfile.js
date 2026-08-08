import pool, { getDBSchema } from '../../db/connection.js';
import { respondSessionInvalid } from '../../utils/sessionInvalidResponse.js';
import { formatMemberDisplayCode, formatMemberIdDigits } from '../../utils/memberDisplayCode.js';
import { referCodeFromMemberId } from '../../utils/referCodeFromMemberId.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { cleanAlias, isValidAliasFormat, ALIAS_ALNUM_ONLY_MESSAGE } from '../../utils/aliasValidation.js';
import nodemailer from 'nodemailer';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { enrichMailOptions, wrapEmailHtml } from '../../lib/emailHtml.js';
import {
  ApiError,
  CheckoutPaymentIntent,
  Client,
  Environment,
  LogLevel,
  OrdersController
} from '@paypal/paypal-server-sdk';
import { parseBooleanEnumRaw, sqlBooleanEnumLiteral } from '../../utils/booleanEnum.js';
import {
  REQUESTS_BRIEF_PAID_COLUMN,
  REQUESTS_FULL_PAID_COLUMN
} from '../../utils/requestsPaidColumns.js';
import { formatLastChangeDateForApi } from '../../utils/accountChangeCooldown.js';
import { formatUserDateTime } from '../../utils/userTimeZone.js';
import { isAdminAuth, logImpersonatedMutation } from '../../utils/adminAuth.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { flushVaultTransferBytes } from '../../utils/vaultTransferTracking.js';
import { flushVaultTransferBytes as flushPhotoAlbumsTransferBytes } from '../../utils/photoAlbumsTransferTracking.js';
import { COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION } from '../../utils/complimentaryNewMemberVaultData.js';

const ADMIN_SET_TOKEN_DESCRIPTION = 'Admin set';
const MAX_ACCOUNT_TOKEN_BALANCE = 20;
const DEFAULT_PRICE_PER_TOKEN = (() => {
  const n = Number(process.env.PRICE_PER_TOKEN);
  return Number.isFinite(n) && n > 0 ? n : 1;
})();
const RECORD_VAULT_GB_PER_TOKEN = (() => {
  const n = Number(process.env.GB_PER_TOKEN);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : 10;
})();
const RECORD_VAULT_MB_PER_TOKEN = RECORD_VAULT_GB_PER_TOKEN * 1024;
const PAYPAL_ORDER_TTL_MS = 30 * 60 * 1000;
let paypalOrdersController = null;
let pendingPaypalOrdersTableReady = false;

const PROFILE_COLUMN_CANDIDATES = {
  id: ['singles_id', 'user_id', 'id'],
  prefix: ['prefix'],
  member_id: ['member_id', 'memberid'],
  alias: ['alias'],
  firstname: ['firstname'],
  lastname: ['lastname', 'last_name'],
  mailing_firstname: ['mailing_firstname'],
  mailing_middlename: ['mailing_middlename'],
  mailing_lastname: ['mailing_lastname'],
  email: ['email'],
  phone: ['phone', 'phone_num'],
  mailing_address: ['mailing_address'],
  mailing_street: ['mailing_street'],
  mailing_city: ['mailing_city'],
  mailing_zip: ['mailing_zip'],
  mailing_country: ['mailing_country'],
  profile_image_fk: ['profile_image_fk'],
  my_refer_code: ['my_refer_code', 'refer_code'],
  last_password_change_date: ['last_password_change_date'],
  last_email_change_date: ['last_email_change_date'],
  last_phone_change_date: ['last_phone_change_date'],
  secret_icon: ['secret_icon'],
  custom_logout_duration: ['custom_logout_duration']
};

function normalizeSixDigitReferCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** DB value, else deterministic code from member_id (same as sendReferralInviteEmail). */
function resolveProfileReferCode(row) {
  const fromDb = normalizeSixDigitReferCode(row?.my_refer_code);
  if (fromDb) return fromDb;
  return normalizeSixDigitReferCode(referCodeFromMemberId(row?.member_id));
}

function cleanNullableText(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text ? text : null;
}

function normalizeProfileValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = String(raw).trim();
  if (!text) return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
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
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function getSinglesColumns(client) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, 'singles']
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
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

async function getRequestColumns(client, schemaName) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schemaName, 'requests']
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMoneyAmount(value) {
  const amount = toFiniteNumber(value, 0);
  return amount.toFixed(2);
}

function paypalEnv() {
  const envName = String(process.env.PAYPAL_ENV || '').trim().toLowerCase();
  return envName === 'live' ? Environment.Production : Environment.Sandbox;
}

function getPaypalOrdersController() {
  if (paypalOrdersController) return paypalOrdersController;
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret
    },
    timeout: 0,
    environment: paypalEnv(),
    logging: {
      logLevel: LogLevel.Info,
      logRequest: { logBody: false },
      logResponse: { logHeaders: true }
    }
  });
  paypalOrdersController = new OrdersController(client);
  return paypalOrdersController;
}

async function ensurePendingPaypalOrdersTable(client) {
  if (pendingPaypalOrdersTableReady) return;
  const schema = sqlIdent(getDBSchema());
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${schema}.pending_paypal_orders (
       singles_id BIGINT PRIMARY KEY,
       order_id TEXT NOT NULL UNIQUE,
       tokens_buying INTEGER NOT NULL,
       price_per_token NUMERIC(12,2) NOT NULL,
       total_price_buying NUMERIC(12,2) NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  pendingPaypalOrdersTableReady = true;
}

async function purgeExpiredPendingPaypalOrders(client) {
  await ensurePendingPaypalOrdersTable(client);
  const schema = sqlIdent(getDBSchema());
  await client.query(
    `DELETE FROM ${schema}.pending_paypal_orders
     WHERE created_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')`,
    [PAYPAL_ORDER_TTL_MS]
  );
}

async function savePendingPaypalOrder(client, { singlesId, orderId, tokensBuying, pricePerToken, totalPriceBuying }) {
  await ensurePendingPaypalOrdersTable(client);
  const schema = sqlIdent(getDBSchema());
  await client.query(
    `INSERT INTO ${schema}.pending_paypal_orders
      (singles_id, order_id, tokens_buying, price_per_token, total_price_buying, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (singles_id) DO UPDATE
       SET order_id = EXCLUDED.order_id,
           tokens_buying = EXCLUDED.tokens_buying,
           price_per_token = EXCLUDED.price_per_token,
           total_price_buying = EXCLUDED.total_price_buying,
           created_at = NOW()`,
    [singlesId, orderId, tokensBuying, pricePerToken, totalPriceBuying]
  );
}

async function getPendingPaypalOrder(client, orderId) {
  await ensurePendingPaypalOrdersTable(client);
  const schema = sqlIdent(getDBSchema());
  const result = await client.query(
    `SELECT singles_id, order_id, tokens_buying, price_per_token, total_price_buying, created_at
     FROM ${schema}.pending_paypal_orders
     WHERE order_id = $1
     LIMIT 1`,
    [orderId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    singlesId: Number(row.singles_id),
    orderId: cleanNullableText(row.order_id),
    tokensBuying: Math.trunc(Number(row.tokens_buying)),
    pricePerToken: Number(row.price_per_token),
    totalPriceBuying: Number(row.total_price_buying),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

async function deletePendingPaypalOrder(client, orderId) {
  await ensurePendingPaypalOrdersTable(client);
  const schema = sqlIdent(getDBSchema());
  await client.query(`DELETE FROM ${schema}.pending_paypal_orders WHERE order_id = $1`, [orderId]);
}

function getAllowedTokensToBuy(tokenBalance) {
  return Math.max(0, MAX_ACCOUNT_TOKEN_BALANCE - Math.max(0, Math.trunc(toFiniteNumber(tokenBalance, 0))));
}

function getDescriptionColumn(paymentColumns) {
  return pickColumn(paymentColumns, ['transaction_description', 'transaction_descripition', 'payment_history', 'description']);
}

function toNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function formatMemberDisplayNumber(_prefixValue, memberIdValue) {
  return formatMemberDisplayCode(memberIdValue);
}

async function resolveMemberDisplayNumber(client, memberCache, { memberIdRaw, singlesIdRaw }) {
  const explicitCode = String(memberIdRaw ?? '').trim();
  if (/^M\d{6}$/i.test(explicitCode)) return explicitCode.toUpperCase();
  if (/^\d{6}$/.test(explicitCode)) return formatMemberDisplayCode(explicitCode);
  if (/^\d{8}$/.test(explicitCode)) return formatMemberDisplayCode(explicitCode.slice(-6));

  const singlesId = toNonNegativeInt(singlesIdRaw);
  if (singlesId != null) {
    if (!memberCache.has(singlesId)) {
      const result = await client.query(
        `SELECT prefix, member_id
         FROM helloworldjunktest.singles
         WHERE singles_id = $1
         LIMIT 1`,
        [singlesId]
      );
      memberCache.set(singlesId, result.rows[0] ?? null);
    }
    const row = memberCache.get(singlesId);
    const fromDb = formatMemberDisplayNumber(row?.prefix, row?.member_id);
    if (fromDb) return fromDb;
  }

  return formatMemberDisplayCode(memberIdRaw) ?? formatMemberIdDigits(memberIdRaw);
}

async function normalizeDebitDescriptionText(client, memberCache, rawDescription) {
  const text = cleanNullableText(rawDescription);
  if (!text) return '';
  let normalized = text;

  const legacyMatch = normalized.match(/debit for view\s+\w+\s+viewing of member\s+([^\s,]+)\s+debit\s+(-?\d+)\s+token/i);
  if (legacyMatch) {
    const memberLabel = legacyMatch[1];
    const debitAbs = Math.abs(Number(legacyMatch[2]));
    const safeDebit = Number.isFinite(debitAbs) && debitAbs > 0 ? debitAbs : 1;
    const tokenWord = safeDebit === 1 ? 'token' : 'tokens';
    normalized = `Debit for viewing member ${memberLabel}, -${safeDebit} ${tokenWord}`;
  }

  const withBracket = normalized.match(/member\s+(\d+)\[(\d+)\](?:\/[^,]+)?/i);
  if (withBracket) {
    const formatted = await resolveMemberDisplayNumber(client, memberCache, {
      memberIdRaw: withBracket[1],
      singlesIdRaw: withBracket[2]
    });
    if (formatted) {
      normalized = normalized.replace(withBracket[0], `member ${formatted}`);
    }
    return normalized;
  }

  const withSlash = normalized.match(/member\s+(\d+)\/(\d+)(?:\/[^,]+)?/i);
  if (withSlash) {
    const formatted = await resolveMemberDisplayNumber(client, memberCache, {
      memberIdRaw: withSlash[1],
      singlesIdRaw: withSlash[2]
    });
    if (formatted) {
      normalized = normalized.replace(withSlash[0], `member ${formatted}`);
    }
    return normalized;
  }

  const plainMember = normalized.match(/member\s+(\d+)\b/i);
  if (plainMember) {
    const formatted = await resolveMemberDisplayNumber(client, memberCache, {
      memberIdRaw: plainMember[1],
      singlesIdRaw: null
    });
    if (formatted) {
      normalized = normalized.replace(plainMember[0], `member ${formatted}`);
    }
  }

  return normalized;
}

function isViewDebitDescription(text) {
  const t = cleanNullableText(text);
  if (!t) return false;
  return /^debit for viewing (?:basic|detail )?member\b/i.test(t);
}

function parseDebitTokenCount(descriptionText) {
  const text = cleanNullableText(descriptionText);
  if (!text) return null;
  const m = text.match(/,\s*(-?\d+)\s*token(?:s)?\b/i);
  if (!m) return null;
  const n = Math.abs(Number(m[1]));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRecordVaultRefillTokenCount(descriptionText) {
  const text = cleanNullableText(descriptionText);
  if (!text) return null;
  const match = text.match(/^Purchase\s+(\d+)\s+token(?:s)?\s+of\s+\d+\s*GB\s+each\b/i);
  const count = Number(match?.[1]);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : null;
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

async function applyTokenPurchaseCreditInTxn(
  client,
  { singlesId, tokensBuying, pricePerToken, paymentMethod = 'paypal', payerNameEmail = null, description, paypalOrderId = null, paypalCaptureId = null }
) {
  const tokenCount = Math.max(0, Math.trunc(toFiniteNumber(tokensBuying, 0)));
  const unitPrice = Math.max(0, toFiniteNumber(pricePerToken, 0));
  if (!tokenCount || !unitPrice) {
    throw new Error('tokensBuying and pricePerToken must be positive numbers');
  }

  await lockTokenBalanceInTxn(client, singlesId);
  const paymentColumns = await getTableColumns(client, 'payment');
  const singlesColumns = await getSinglesColumns(client);
  const singleExistsResult = await client.query(
    `SELECT singles_id
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  if (!singleExistsResult.rows.length) {
    throw new Error('User profile not found');
  }

  const totalPriceBuying = tokenCount * unitPrice;
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
  const nextBalance = prevBalance + tokenCount;
  const nextPaidDollar = prevPaidDollar + totalPriceBuying;
  const nextPaidToken = prevPaidToken + tokenCount;
  const now = new Date();
  const paymentHistoryText =
    cleanNullableText(description) ||
    `Done ${paymentMethod} payment: +${tokenCount} tokens, $${toMoneyAmount(totalPriceBuying)}`;

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
  pushIfExists('payment_history', paymentHistoryText);
  pushIfExists('transaction_description', paymentHistoryText);
  pushIfExists('account_balance_token', nextBalance);
  pushIfExists('paid_total_dollar', nextPaidDollar);
  pushIfExists('token_add_or_debit', nextPaidToken);
  pushIfExists('transaction_date_time', now);
  pushIfExists('last_paid_date', now);
  pushIfExists('last_payment_email', payerNameEmail);
  pushIfExists('paypal_order_id', cleanNullableText(paypalOrderId));
  pushIfExists('paypal_capture_id', cleanNullableText(paypalCaptureId));
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
    if (singlesColumns.has('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $2`,
      [paymentId, singlesId]
    );
  }

  const persistedBalanceResult = await client.query(
    `SELECT account_balance_token
     FROM helloworldjunktest.payment
     WHERE payment_id = $1
     LIMIT 1`,
    [paymentId]
  );
  const persistedBalance = toFiniteNumber(persistedBalanceResult.rows[0]?.account_balance_token, nextBalance);

  return {
    paymentId: Number.isFinite(paymentId) ? paymentId : null,
    transactionId,
    persistedBalance,
    nextPaidDollar,
    nextPaidToken,
    totalPriceBuying,
    paymentHistoryText,
    occurredAt: now
  };
}

async function findExistingPaypalPayment(client, singlesId, orderId, captureId = null) {
  const paymentColumns = await getTableColumns(client, 'payment');
  const singlesIdColumn = pickColumn(paymentColumns, ['singles_id', 'singles_id_fk']);
  if (!singlesIdColumn) return null;

  const orderColumn = pickColumn(paymentColumns, ['paypal_order_id']);
  const captureColumn = pickColumn(paymentColumns, ['paypal_capture_id']);
  const descriptionColumn = getDescriptionColumn(paymentColumns);

  if (captureId && captureColumn) {
    const byCapture = await client.query(
      `SELECT payment_id, account_balance_token
       FROM helloworldjunktest.payment
       WHERE ${sqlIdent(singlesIdColumn)} = $1
         AND ${sqlIdent(captureColumn)} = $2
       ORDER BY payment_id DESC
       LIMIT 1`,
      [singlesId, captureId]
    );
    if (byCapture.rows.length) return byCapture.rows[0];
  }

  if (orderColumn) {
    const byOrder = await client.query(
      `SELECT payment_id, account_balance_token
       FROM helloworldjunktest.payment
       WHERE ${sqlIdent(singlesIdColumn)} = $1
         AND ${sqlIdent(orderColumn)} = $2
       ORDER BY payment_id DESC
       LIMIT 1`,
      [singlesId, orderId]
    );
    if (byOrder.rows.length) return byOrder.rows[0];
  }

  if (descriptionColumn) {
    const byDescription = await client.query(
      `SELECT payment_id, account_balance_token
       FROM helloworldjunktest.payment
       WHERE ${sqlIdent(singlesIdColumn)} = $1
         AND ${sqlIdent(descriptionColumn)} ILIKE $2
       ORDER BY payment_id DESC
       LIMIT 1`,
      [singlesId, `%PayPal order ${orderId}%`]
    );
    if (byDescription.rows.length) return byDescription.rows[0];
  }

  return null;
}

async function getTokenBalance(client, singlesId) {
  try {
    const tokenResult = await client.query(
      `SELECT p.account_balance_token
       FROM helloworldjunktest.singles s
       LEFT JOIN helloworldjunktest.payment p ON p.payment_id = s.payment_id_fk
       WHERE s.singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    if (!tokenResult.rows.length) return 0;
    const n = Number(tokenResult.rows[0].account_balance_token);
    return Number.isFinite(n) ? n : 0;
  } catch (err) {
    // Keep settings usable even if payment table/columns are not ready.
    console.warn('[settingsProfile] token balance lookup fallback:', err?.message || err);
    return 0;
  }
}

/** Serialize all token-balance mutations for one member inside the caller's transaction. */
async function lockTokenBalanceInTxn(client, singlesId) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [Math.trunc(Number(singlesId))]);
}

function isSmtpConfiguredForMail() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return Boolean(
    smtpUser &&
      smtpPass &&
      smtpUser !== 'your-email@gmail.com' &&
      smtpPass !== 'your-app-password'
  );
}

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReceiptDateTime(value, { zip = null, phone = null } = {}) {
  return formatUserDateTime(value, { zip, phone });
}

function formatTransactionIdForDisplay(transactionId) {
  if (transactionId == null) return '';
  const n = Math.trunc(Number(transactionId));
  if (!Number.isFinite(n) || n < 0) return String(transactionId);
  return String(n).padStart(8, '0');
}

function parsePaypalCustomId(rawCustomId) {
  const text = cleanNullableText(rawCustomId);
  if (!text) return null;
  const m = text.match(/^singles:(\d+)\|tokens:(\d+)\|pp:(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const singlesId = Math.trunc(Number(m[1]));
  const tokensBuying = Math.trunc(Number(m[2]));
  const pricePerToken = Number(m[3]);
  if (!Number.isFinite(singlesId) || singlesId < 1) return null;
  if (!Number.isFinite(tokensBuying) || tokensBuying < 1) return null;
  if (!Number.isFinite(pricePerToken) || pricePerToken <= 0) return null;
  return { singlesId, tokensBuying, pricePerToken };
}

function recoverPendingOrderFromPaypalOrder({ orderData, singlesId, fallbackOrderId = null }) {
  const purchaseUnit = orderData?.purchase_units?.[0];
  const parsedCustomId = parsePaypalCustomId(purchaseUnit?.custom_id);
  if (!parsedCustomId) return null;
  if (Number(parsedCustomId.singlesId) !== Number(singlesId)) return null;
  const totalPriceBuying = toFiniteNumber(purchaseUnit?.amount?.value, NaN);
  if (!Number.isFinite(totalPriceBuying) || totalPriceBuying <= 0) return null;
  return {
    singlesId: parsedCustomId.singlesId,
    tokensBuying: parsedCustomId.tokensBuying,
    pricePerToken: parsedCustomId.pricePerToken,
    totalPriceBuying,
    createdAt: Date.now(),
    orderId: cleanNullableText(orderData?.id) || cleanNullableText(fallbackOrderId)
  };
}

function parsePaypalApiError(error, fallbackMessage) {
  const statusCode = Number(error?.statusCode || error?.status || 0) || null;
  const debugIdFromHeaders = error?.headers?.['paypal-debug-id'] || error?.headers?.['PayPal-Debug-Id'] || null;
  const rawBody = error?.body;
  let parsedBody = null;
  if (rawBody && typeof rawBody === 'string') {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  } else if (rawBody && typeof rawBody === 'object') {
    parsedBody = rawBody;
  }

  const name = cleanNullableText(parsedBody?.name);
  const message = cleanNullableText(parsedBody?.message) || cleanNullableText(error?.message) || fallbackMessage;
  const debugId = cleanNullableText(parsedBody?.debug_id) || cleanNullableText(debugIdFromHeaders);
  const issue = cleanNullableText(parsedBody?.details?.[0]?.issue);
  const description = cleanNullableText(parsedBody?.details?.[0]?.description);

  const messageParts = [message];
  if (statusCode) messageParts.push(`status=${statusCode}`);
  if (name) messageParts.push(`name=${name}`);
  if (issue) messageParts.push(`issue=${issue}`);
  if (description) messageParts.push(`detail=${description}`);
  if (debugId) messageParts.push(`debug_id=${debugId}`);

  return {
    statusCode: statusCode || 502,
    clientMessage: messageParts.join(' | ')
  };
}

async function resolveSinglesTimeZoneProfile(singlesId) {
  try {
    const { rows } = await pool.query(
      `SELECT mailing_zip, phone
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    return {
      mailingZip: cleanNullableText(rows[0]?.mailing_zip),
      phone: cleanNullableText(rows[0]?.phone)
    };
  } catch {
    return { mailingZip: null, phone: null };
  }
}

function sendPaymentReceiptEmailFireAndForget({
  singlesId,
  paymentId,
  transactionId,
  occurredAt,
  amountDollar,
  amountTokenDelta,
  balanceToken,
  description,
  mailingZip = null,
  phone = null
}) {
  void (async () => {
    if (!isSmtpConfiguredForMail()) {
      console.warn('[settingsProfile:paymentReceipt] SMTP not configured; skipping receipt email.');
      return;
    }

    let resolvedZip = mailingZip;
    let resolvedPhone = phone;
    if (!resolvedZip && !resolvedPhone) {
      const profile = await resolveSinglesTimeZoneProfile(singlesId);
      resolvedZip = profile.mailingZip;
      resolvedPhone = profile.phone;
    }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;

  const txnLabel = formatTransactionIdForDisplay(transactionId);
  const when = formatReceiptDateTime(occurredAt || new Date(), { zip: resolvedZip, phone: resolvedPhone });
  const dollarCell =
    amountDollar == null || !Number.isFinite(Number(amountDollar)) ? 'N/A' : `$${Number(amountDollar).toFixed(2)}`;
  const tokenDelta = Number(amountTokenDelta);
  const tokenCell = Number.isFinite(tokenDelta)
    ? `${tokenDelta > 0 ? '+' : ''}${tokenDelta} ${Math.abs(tokenDelta) === 1 ? 'token' : 'tokens'}`
    : '';
  const balanceCell = Number.isFinite(Number(balanceToken)) ? `${Number(balanceToken)} tokens` : '';

  const html = wrapEmailHtml(
    `
      <h2 style="color:#222;">Thank you for your payment</h2>
      <p style="color:#333; line-height:1.5;">
        We received a new payment entry for singles_id <strong>${escapeHtml(singlesId)}</strong>.
        Your updated token balance is <strong>${escapeHtml(balanceCell)}</strong>.
      </p>
      <p style="color:#333; line-height:1.5;">Below is the latest payment line (same columns as Balance History):</p>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; max-width:720px;">
        <thead>
          <tr style="background:#f3f3f3;">
            <th align="left">Transaction ID</th>
            <th align="left">Date</th>
            <th align="left">Amount $</th>
            <th align="left">Amount Token</th>
            <th align="left">Balance Token</th>
            <th align="left">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(txnLabel)}</td>
            <td>${escapeHtml(when)}</td>
            <td>${escapeHtml(dollarCell)}</td>
            <td>${escapeHtml(tokenCell)}</td>
            <td>${escapeHtml(balanceCell)}</td>
            <td>${escapeHtml(description || '')}</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:18px; color:#666; font-size:12px;">
        Internal receipt (testing): payment_id=${escapeHtml(paymentId)} · singles_id=${escapeHtml(singlesId)}
      </p>
    `,
    { maxWidth: '720px' }
  );

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPortNum,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });
      await transporter.sendMail(
        enrichMailOptions({
          from: OUTBOUND_EMAIL_FROM_HEADER,
          to: PAYMENT_RECEIPT_TO_EMAIL,
          subject: `Payment receipt${txnLabel ? ` (Txn ${txnLabel})` : ''}`,
          html
        })
      );
    } catch (err) {
      console.error('[settingsProfile:paymentReceipt] sendMail failed:', err?.message || err);
    }
  })().catch((err) => {
    console.error('[settingsProfile:paymentReceipt] failed:', err?.message || err);
  });
}

export async function completeSettingsPayment(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = req.body || {};
  const tokensBuying = Math.max(0, Math.trunc(toFiniteNumber(payload.tokens_buying)));
  const pricePerToken = Math.max(0, toFiniteNumber(payload.price_per_token));
  const paymentMethod = cleanNullableText(payload.payment_method) || 'paypal';
  const payerNameEmail = cleanNullableText(payload.payer_name_email);

  if (!tokensBuying || !pricePerToken) {
    return res.status(400).json({ error: 'tokens_buying and price_per_token must be positive numbers' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenBalance = await getTokenBalance(client, singlesId);
    const allowedToBuy = getAllowedTokensToBuy(tokenBalance);
    if (tokensBuying > allowedToBuy) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `For your protection, we allow maximum of ${MAX_ACCOUNT_TOKEN_BALANCE} token per account balance. You can buy up to ${allowedToBuy} more token only.`
      });
    }
    const payment = await applyTokenPurchaseCreditInTxn(client, {
      singlesId,
      tokensBuying,
      pricePerToken,
      paymentMethod,
      payerNameEmail
    });

    await client.query('COMMIT');

    if (Number.isFinite(payment.paymentId) && payment.paymentId > 0) {
      sendPaymentReceiptEmailFireAndForget({
        singlesId,
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        occurredAt: payment.occurredAt,
        amountDollar: payment.totalPriceBuying,
        amountTokenDelta: tokensBuying,
        balanceToken: payment.persistedBalance,
        description: payment.paymentHistoryText
      });
    }

    return res.json({
      ok: true,
      singles_id: singlesId,
      payment_id: payment.paymentId,
      transaction_id: payment.transactionId,
      token_balance: payment.persistedBalance,
      paid_total_dollar: payment.nextPaidDollar,
      token_add_or_debit: payment.nextPaidToken,
      total_price_buying: payment.totalPriceBuying
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[settingsProfile:completePayment]', error);
    return res.status(500).json({ error: 'Failed to complete payment' });
  } finally {
    client.release();
  }
}

export async function createSettingsPaypalOrder(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const ordersController = getPaypalOrdersController();
  if (!ordersController) {
    return res.status(500).json({ error: 'PayPal is not configured on the server' });
  }

  const payload = req.body || {};
  const tokensBuying = Math.max(0, Math.trunc(toFiniteNumber(payload.tokens_buying)));
  if (!tokensBuying) {
    return res.status(400).json({ error: 'tokens_buying must be a positive integer' });
  }
  if (tokensBuying > MAX_ACCOUNT_TOKEN_BALANCE) {
    return res.status(400).json({ error: `tokens_buying cannot exceed ${MAX_ACCOUNT_TOKEN_BALANCE}` });
  }

  const client = await pool.connect();
  try {
    const tokenBalance = await getTokenBalance(client, singlesId);
    const allowedToBuy = getAllowedTokensToBuy(tokenBalance);
    if (tokensBuying > allowedToBuy) {
      return res.status(400).json({
        error: `For your protection, we allow maximum of ${MAX_ACCOUNT_TOKEN_BALANCE} token per account balance. You can buy up to ${allowedToBuy} more token only.`
      });
    }

    const totalPriceBuying = tokensBuying * DEFAULT_PRICE_PER_TOKEN;
    const collect = {
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            customId: `singles:${singlesId}|tokens:${tokensBuying}|pp:${DEFAULT_PRICE_PER_TOKEN}`,
            amount: {
              currencyCode: 'USD',
              value: toMoneyAmount(totalPriceBuying)
            }
          }
        ]
      },
      prefer: 'return=minimal'
    };
    const { body } = await ordersController.createOrder(collect);
    const parsed = JSON.parse(body);
    if (!parsed?.id) {
      return res.status(502).json({ error: 'Failed to create PayPal order' });
    }

    await purgeExpiredPendingPaypalOrders(client);
    await savePendingPaypalOrder(client, {
      singlesId,
      orderId: parsed.id,
      tokensBuying,
      pricePerToken: DEFAULT_PRICE_PER_TOKEN,
      totalPriceBuying
    });

    return res.json({
      id: parsed.id,
      tokens_buying: tokensBuying,
      total_price_buying: Number(toMoneyAmount(totalPriceBuying))
    });
  } catch (error) {
    console.error('[settingsProfile:createSettingsPaypalOrder]', error);
    if (error instanceof ApiError) {
      const parsed = parsePaypalApiError(error, 'PayPal create order failed');
      return res.status(502).json({ error: parsed.clientMessage });
    }
    return res.status(500).json({ error: 'Failed to create PayPal order' });
  } finally {
    client.release();
  }
}

export async function captureSettingsPaypalOrder(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const ordersController = getPaypalOrdersController();
  if (!ordersController) {
    return res.status(500).json({ error: 'PayPal is not configured on the server' });
  }

  const orderID = cleanNullableText(req.params?.orderID);
  if (!orderID) {
    return res.status(400).json({ error: 'orderID is required' });
  }

  let pendingOrder = null;
  const pendingClient = await pool.connect();
  try {
    await purgeExpiredPendingPaypalOrders(pendingClient);
    pendingOrder = await getPendingPaypalOrder(pendingClient, orderID);
  } finally {
    pendingClient.release();
  }
  if (!pendingOrder || Number(pendingOrder.singlesId) !== singlesId) {
    // Recover from stateless deployments / restarts by reading order custom_id from PayPal.
    try {
      const lookup = { id: orderID, prefer: 'return=representation' };
      const { body } = await ordersController.getOrder(lookup);
      const orderData = JSON.parse(body);
      const recovered = recoverPendingOrderFromPaypalOrder({ orderData, singlesId, fallbackOrderId: orderID });
      if (recovered) {
        pendingOrder = recovered;
        const recoverClient = await pool.connect();
        try {
          await savePendingPaypalOrder(recoverClient, {
            singlesId: recovered.singlesId,
            orderId: orderID,
            tokensBuying: recovered.tokensBuying,
            pricePerToken: recovered.pricePerToken,
            totalPriceBuying: recovered.totalPriceBuying
          });
        } finally {
          recoverClient.release();
        }
      }
    } catch (recoverErr) {
      console.warn('[settingsProfile:captureSettingsPaypalOrder] pending order recover failed:', recoverErr?.message || recoverErr);
    }
  }
  if (!pendingOrder || Number(pendingOrder.singlesId) !== singlesId) {
    return res.status(400).json({ error: 'Order is missing or expired. Please try checkout again.' });
  }

  try {
    const collect = {
      id: orderID,
      prefer: 'return=representation'
    };
    const { body } = await ordersController.captureOrder(collect);
    const orderData = JSON.parse(body);
    const capture = orderData?.purchase_units?.[0]?.payments?.captures?.[0];
    const payerEmail = cleanNullableText(orderData?.payer?.email_address);
    const captureAmount = toFiniteNumber(capture?.amount?.value, NaN);
    const expectedAmount = toFiniteNumber(pendingOrder.totalPriceBuying, NaN);
    if (!Number.isFinite(captureAmount) || !Number.isFinite(expectedAmount) || Math.abs(captureAmount - expectedAmount) > 0.01) {
      return res.status(400).json({ error: 'Captured amount does not match expected order amount' });
    }
    const captureStatus = String(capture?.status || orderData?.status || '').toUpperCase();
    if (!['COMPLETED', 'PENDING'].includes(captureStatus)) {
      return res.status(400).json({ error: `PayPal capture status is ${captureStatus || 'UNKNOWN'}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await findExistingPaypalPayment(client, singlesId, orderID, cleanNullableText(capture?.id));
      if (existing) {
        const balance = await getTokenBalance(client, singlesId);
        await deletePendingPaypalOrder(client, orderID);
        await client.query('COMMIT');
        return res.json({
          ok: true,
          duplicate: true,
          order_id: orderID,
          capture_id: cleanNullableText(capture?.id),
          token_balance: balance
        });
      }

      const payment = await applyTokenPurchaseCreditInTxn(client, {
        singlesId,
        tokensBuying: pendingOrder.tokensBuying,
        pricePerToken: pendingOrder.pricePerToken,
        paymentMethod: 'paypal',
        payerNameEmail: payerEmail,
        description: `Done paypal payment: +${pendingOrder.tokensBuying} tokens, $${toMoneyAmount(
          pendingOrder.totalPriceBuying
        )} (PayPal order ${orderID}, capture ${capture?.id || 'unknown'})`,
        paypalOrderId: orderID,
        paypalCaptureId: cleanNullableText(capture?.id)
      });
      await deletePendingPaypalOrder(client, orderID);
      await client.query('COMMIT');

      if (Number.isFinite(payment.paymentId) && payment.paymentId > 0) {
        sendPaymentReceiptEmailFireAndForget({
          singlesId,
          paymentId: payment.paymentId,
          transactionId: payment.transactionId,
          occurredAt: payment.occurredAt,
          amountDollar: payment.totalPriceBuying,
          amountTokenDelta: pendingOrder.tokensBuying,
          balanceToken: payment.persistedBalance,
          description: payment.paymentHistoryText
        });
      }

      return res.json({
        ok: true,
        order_id: orderID,
        capture_id: cleanNullableText(capture?.id),
        token_balance: payment.persistedBalance,
        payment_id: payment.paymentId,
        transaction_id: payment.transactionId,
        order_data: orderData
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[settingsProfile:captureSettingsPaypalOrder]', error);
    if (error instanceof ApiError) {
      const parsed = parsePaypalApiError(error, 'PayPal capture failed');
      return res.status(502).json({ error: parsed.clientMessage });
    }
    return res.status(500).json({ error: 'Failed to capture PayPal order' });
  }
}

/**
 * POST /api/recordVault/refill
 * Redeem account tokens for TutaNotes Tx/Rx data. The token debit, payment ledger
 * entry, and singles.refill_remain_mb credit commit in one Primary transaction.
 */
export async function purchaseRecordVaultRefill(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const tokens = Math.trunc(Number(req.body?.tokens));
  if (!Number.isFinite(tokens) || tokens < 1 || tokens > MAX_ACCOUNT_TOKEN_BALANCE) {
    return res.status(400).json({ error: `tokens must be a whole number from 1 to ${MAX_ACCOUNT_TOKEN_BALANCE}` });
  }

  // Apply any in-flight Tx/Rx bytes first so refill_remain_mb after purchase matches what the UI shows.
  await flushVaultTransferBytes(singlesId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockTokenBalanceInTxn(client, singlesId);
    const memberResult = await client.query(
      `SELECT singles_id, refill_remain_mb, refill_bought_mb
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       FOR UPDATE`,
      [singlesId]
    );
    if (!memberResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User profile not found' });
    }

    const paymentColumns = await getTableColumns(client, 'payment');
    const singlesColumns = await getSinglesColumns(client);
    const latestPaymentResult = await client.query(
      `SELECT payment_id, account_balance_token, paid_total_dollar, token_add_or_debit
       FROM helloworldjunktest.payment
       WHERE singles_id = $1
       ORDER BY payment_id DESC
       LIMIT 1`,
      [singlesId]
    );
    const latestPayment = latestPaymentResult.rows[0] || {};
    const previousBalance = Math.max(
      0,
      Math.trunc(toFiniteNumber(latestPayment.account_balance_token, 0))
    );
    if (previousBalance < tokens) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Insufficient token balance. You have ${previousBalance} token${previousBalance === 1 ? '' : 's'}.`
      });
    }

    const nextBalance = previousBalance - tokens;
    const previousPaidDollar = toFiniteNumber(latestPayment.paid_total_dollar, 0);
    const previousPaidToken = toFiniteNumber(latestPayment.token_add_or_debit, 0);
    const refillMb = tokens * RECORD_VAULT_MB_PER_TOKEN;
    const totalGb = tokens * RECORD_VAULT_GB_PER_TOKEN;
    const tokenWord = tokens === 1 ? 'token' : 'tokens';
    const description =
      `Purchase ${tokens} ${tokenWord} of ${RECORD_VAULT_GB_PER_TOKEN}GB each, total ${totalGb}GB`;
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
    pushIfExists('payment_history', description);
    pushIfExists('transaction_description', description);
    pushIfExists('account_balance_token', nextBalance);
    // This is a token redemption, not a second PayPal charge; preserve cumulative paid dollars.
    pushIfExists('paid_total_dollar', previousPaidDollar);
    pushIfExists('paid_total_token', previousPaidToken - tokens);
    pushIfExists('token_add_or_debit', -tokens);
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

    const refillResult = await client.query(
      'SELECT helloworldjunktest.add_vault_refill_mb($1, $2) AS refill_remain_mb',
      [singlesId, refillMb]
    );
    const refillRemainMb = Number(refillResult.rows[0]?.refill_remain_mb);
    const boughtResult = await client.query(
      `SELECT refill_bought_mb
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    const refillBoughtMb = Number(boughtResult.rows[0]?.refill_bought_mb);

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

    await client.query('COMMIT');
    return res.json({
      ok: true,
      tokens_purchased: tokens,
      token_balance: nextBalance,
      refill_added_mb: refillMb,
      refill_remain_mb: Number.isFinite(refillRemainMb) ? refillRemainMb : null,
      refill_bought_mb: Number.isFinite(refillBoughtMb) ? refillBoughtMb : null,
      gb_per_token: RECORD_VAULT_GB_PER_TOKEN,
      total_gb: totalGb,
      price_dollar: tokens * DEFAULT_PRICE_PER_TOKEN,
      payment_id: Number.isFinite(paymentId) ? paymentId : null,
      transaction_id: transactionId,
      description,
      date: now
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[settingsProfile:purchaseRecordVaultRefill]', error?.message || error);
    const message = /refill_remain_mb|refill_bought_mb|add_vault_refill_mb/i.test(String(error?.message || ''))
      ? 'TutaNotes data refill database migration is not installed'
      : 'Failed to purchase TutaNotes data';
    return res.status(500).json({ error: message });
  } finally {
    client.release();
  }
}

export async function getSettingsPaymentHistory(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    const paymentColumns = await getTableColumns(client, 'payment');
    const singlesIdColumn = pickColumn(paymentColumns, ['singles_id', 'singles_id_fk']);
    if (!singlesIdColumn) {
      return res.json({ rows: [] });
    }

    const paymentIdColumn = pickColumn(paymentColumns, ['payment_id']);
    const transactionIdColumn = pickColumn(paymentColumns, ['transactionId', 'transaction_id']);
    const dateColumn = pickColumn(paymentColumns, ['transaction_date_time', 'last_paid_date', 'created_at']);
    const amountDollarColumn = pickColumn(paymentColumns, ['paid_total_dollar', 'paid_total_amount', 'total_paid_dollar']);
    const amountTokenColumn = pickColumn(paymentColumns, ['token_add_or_debit', 'paid_token', 'tokens_paid']);
    const balanceTokenColumn = pickColumn(paymentColumns, ['account_balance_token', 'aacount_balance_token', 'balance_token']);
    const descriptionColumn = pickColumn(paymentColumns, ['transaction_description', 'transaction_descripition', 'payment_history', 'description']);
    const orderByColumn = paymentIdColumn || pickColumn(paymentColumns, ['last_paid_date', 'created_at']) || singlesIdColumn;

    const selectParts = [];
    if (paymentIdColumn) selectParts.push(`${sqlIdent(paymentIdColumn)} AS payment_id`);
    if (transactionIdColumn) selectParts.push(`${sqlIdent(transactionIdColumn)} AS transaction_id`);
    if (dateColumn) selectParts.push(`${sqlIdent(dateColumn)} AS pay_date`);
    if (amountDollarColumn) selectParts.push(`${sqlIdent(amountDollarColumn)} AS amount_dollar`);
    if (amountTokenColumn) selectParts.push(`${sqlIdent(amountTokenColumn)} AS amount_token`);
    if (balanceTokenColumn) selectParts.push(`${sqlIdent(balanceTokenColumn)} AS balance_token`);
    if (descriptionColumn) selectParts.push(`${sqlIdent(descriptionColumn)} AS description`);
    if (!selectParts.length) {
      return res.json({ rows: [] });
    }

    const historyResult = await client.query(
      `SELECT ${selectParts.join(', ')}
       FROM helloworldjunktest.payment
       WHERE ${singlesIdColumn} = $1
       ORDER BY ${orderByColumn} ASC`,
      [singlesId]
    );

    const ascRows = historyResult.rows || [];
    const memberCache = new Map();
    const normalizedRows = await Promise.all(ascRows.map(async (row, idx) => {
      const currentBalance = toFiniteNumber(row.balance_token, NaN);
      const prevBalance = idx > 0 ? toFiniteNumber(ascRows[idx - 1]?.balance_token, NaN) : NaN;
      const tokenDeltaFromBalance = Number.isFinite(currentBalance) && Number.isFinite(prevBalance) ? currentBalance - prevBalance : NaN;

      const currentTokenTotal = toFiniteNumber(row.amount_token, NaN);
      const prevTokenTotal = idx > 0 ? toFiniteNumber(ascRows[idx - 1]?.amount_token, 0) : 0;
      const tokenDeltaFromAmount = Number.isFinite(currentTokenTotal)
        ? currentTokenTotal < 0
          ? currentTokenTotal
          : currentTokenTotal - prevTokenTotal
        : NaN;
      const tokenDeltaCandidate = Number.isFinite(tokenDeltaFromBalance) ? tokenDeltaFromBalance : tokenDeltaFromAmount;

      const currentDollarTotal = toFiniteNumber(row.amount_dollar, NaN);
      const prevDollarTotal = idx > 0 ? toFiniteNumber(ascRows[idx - 1]?.amount_dollar, 0) : 0;
      const dollarDelta = Number.isFinite(currentDollarTotal) ? currentDollarTotal - prevDollarTotal : NaN;

      const normalizedDescription = await normalizeDebitDescriptionText(client, memberCache, row.description);
      const isDebitDescription = isViewDebitDescription(normalizedDescription);
      const debitTokenCountFromText = parseDebitTokenCount(normalizedDescription);
      const refillTokenCount = parseRecordVaultRefillTokenCount(normalizedDescription);
      const isComplimentaryVaultData =
        String(normalizedDescription || '').trim() === COMPLIMENTARY_NEW_MEMBER_DATA_DESCRIPTION;
      const tokenDelta = isComplimentaryVaultData
        ? 0
        : Number.isFinite(refillTokenCount)
          ? -refillTokenCount
          : isDebitDescription && Number.isFinite(debitTokenCountFromText)
            ? -debitTokenCountFromText
            : tokenDeltaCandidate;
      const normalizedDollarAmount = isComplimentaryVaultData
        ? 0
        : Number.isFinite(refillTokenCount)
          ? refillTokenCount * DEFAULT_PRICE_PER_TOKEN
          : Number.isFinite(dollarDelta) && !(isDebitDescription || (Number.isFinite(tokenDelta) && tokenDelta < 0))
            ? dollarDelta
            : null;

      return {
        payment_id: row.payment_id == null ? idx + 1 : Number(row.payment_id),
        transaction_id: row.transaction_id == null ? null : Number(row.transaction_id),
        date: row.pay_date || null,
        amount_dollar: normalizedDollarAmount,
        amount_token: Number.isFinite(tokenDelta) ? tokenDelta : null,
        balance_token: row.balance_token == null ? null : Number(row.balance_token),
        description: normalizedDescription
      };
    }));

    return res.json({
      rows: normalizedRows.sort((a, b) => b.payment_id - a.payment_id)
    });
  } catch (error) {
    console.error('[settingsProfile:paymentHistory]', error);
    return res.status(500).json({ error: 'Failed to load payment history' });
  } finally {
    client.release();
  }
}

function parseAdminSetTokenBalance(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function insertAdminSetTokenBalanceInTxn(client, singlesId, nextBalance, memberEmail) {
  await lockTokenBalanceInTxn(client, singlesId);
  const paymentColumns = await getTableColumns(client, 'payment');
  const singlesColumns = await getSinglesColumns(client);
  const balance = Math.trunc(toFiniteNumber(nextBalance, 0));
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error('account_balance_token must be a non-negative number');
  }

  const latestPaymentResult = await client.query(
    `SELECT payment_id, paid_total_dollar, token_add_or_debit
     FROM helloworldjunktest.payment
     WHERE singles_id = $1
     ORDER BY payment_id DESC
     LIMIT 1`,
    [singlesId]
  );
  const latestPayment = latestPaymentResult.rows[0] || {};
  const prevPaidDollar = toFiniteNumber(latestPayment?.paid_total_dollar, 0);
  const prevPaidToken = toFiniteNumber(latestPayment?.token_add_or_debit, 0);
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
  pushIfExists('transaction_description', ADMIN_SET_TOKEN_DESCRIPTION);
  pushIfExists('payment_history', ADMIN_SET_TOKEN_DESCRIPTION);
  pushIfExists('account_balance_token', balance);
  pushIfExists('paid_total_dollar', prevPaidDollar);
  pushIfExists('token_add_or_debit', prevPaidToken);
  pushIfExists('transaction_date_time', now);
  pushIfExists('last_paid_date', now);
  pushIfExists('last_payment_email', cleanNullableText(memberEmail));

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
    if (singlesColumns.has('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $2`,
      [paymentId, singlesId]
    );
  }

  return {
    paymentId: Number.isFinite(paymentId) ? paymentId : null,
    transactionId,
    account_balance_token: balance
  };
}

async function adminSetTokenBalanceForSinglesId(req, res, singlesId, { logImpersonation = false } = {}) {
  const nextBalance = parseAdminSetTokenBalance(req.body?.account_balance_token ?? req.body?.token_balance);
  if (nextBalance == null) {
    return res.status(400).json({ error: 'account_balance_token must be a non-negative number' });
  }

  const client = await pool.connect();
  try {
    const memberResult = await client.query(
      `SELECT singles_id, email
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    if (!memberResult.rows.length) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const memberEmail = cleanNullableText(memberResult.rows[0]?.email);

    await client.query('BEGIN');
    const payment = await insertAdminSetTokenBalanceInTxn(client, singlesId, nextBalance, memberEmail);
    await client.query('COMMIT');
    if (logImpersonation) {
      logImpersonatedMutation(req);
    }

    return res.json({
      ok: true,
      singlesId,
      account_balance_token: payment.account_balance_token,
      token_balance: payment.account_balance_token,
      accountBalanceToken: payment.account_balance_token,
      payment_id: payment.paymentId,
      transaction_id: payment.transactionId
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[settingsProfile:adminSetTokenBalance]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to set token balance' });
  } finally {
    client.release();
  }
}

/** PUT /api/admin/payment/token-balance — admin impersonation only; inserts payment row with absolute balance. */
export async function putAdminImpersonatedTokenBalance(req, res) {
  const auth = req.auth;
  if (!auth || !isAdminAuth(auth)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (auth.tools_only === true) {
    return res.status(403).json({ error: 'Impersonate a member to set token balance' });
  }

  const singlesId = Number(auth.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(403).json({ error: 'Invalid impersonation session' });
  }

  return adminSetTokenBalanceForSinglesId(req, res, singlesId, { logImpersonation: true });
}

function parseAdminVaultQuotaMb(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  // Remain may go negative (over-quota); bought must stay non-negative.
  return n;
}

/**
 * PUT /api/admin/vault/refill-quota — admin impersonation only.
 * Body: { refill_remain_mb?, refill_bought_mb? } absolute MB values (integers).
 * Sets singles.refill_remain_mb / refill_bought_mb for the impersonated member.
 */
export async function putAdminImpersonatedVaultRefillQuota(req, res) {
  const auth = req.auth;
  if (!auth || !isAdminAuth(auth)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (auth.tools_only === true) {
    return res.status(403).json({ error: 'Impersonate a member to set data quota' });
  }

  const singlesId = Number(auth.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(403).json({ error: 'Invalid impersonation session' });
  }

  const hasRemain =
    req.body?.refill_remain_mb != null ||
    req.body?.refillRemainMb != null ||
    req.body?.remain_mb != null;
  const hasBought =
    req.body?.refill_bought_mb != null ||
    req.body?.refillBoughtMb != null ||
    req.body?.bought_mb != null;

  if (!hasRemain && !hasBought) {
    return res.status(400).json({
      error: 'Provide refill_remain_mb and/or refill_bought_mb (MB integers)'
    });
  }

  let remainMb = null;
  let boughtMb = null;
  if (hasRemain) {
    remainMb = parseAdminVaultQuotaMb(
      req.body?.refill_remain_mb ?? req.body?.refillRemainMb ?? req.body?.remain_mb
    );
    if (remainMb == null) {
      return res.status(400).json({ error: 'refill_remain_mb must be a number (MB)' });
    }
  }
  if (hasBought) {
    boughtMb = parseAdminVaultQuotaMb(
      req.body?.refill_bought_mb ?? req.body?.refillBoughtMb ?? req.body?.bought_mb
    );
    if (boughtMb == null || boughtMb < 0) {
      return res.status(400).json({ error: 'refill_bought_mb must be a non-negative number (MB)' });
    }
  }

  // Flush pending Tx/Rx so the absolute remain write is not immediately reduced again.
  await flushVaultTransferBytes(singlesId);
  await flushPhotoAlbumsTransferBytes(singlesId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const memberResult = await client.query(
      `SELECT singles_id, refill_remain_mb, refill_bought_mb
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       FOR UPDATE`,
      [singlesId]
    );
    if (!memberResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User profile not found' });
    }

    const sets = [];
    const params = [];
    if (remainMb != null) {
      params.push(remainMb);
      sets.push(`refill_remain_mb = $${params.length}`);
    }
    if (boughtMb != null) {
      params.push(boughtMb);
      sets.push(`refill_bought_mb = $${params.length}`);
    }
    params.push(singlesId);
    const updated = await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${sets.join(', ')}
       WHERE singles_id = $${params.length}
       RETURNING refill_remain_mb, refill_bought_mb`,
      params
    );
    await client.query('COMMIT');
    logImpersonatedMutation(req);

    const row = updated.rows[0] || {};
    return res.json({
      ok: true,
      singlesId,
      refill_remain_mb: Number(row.refill_remain_mb),
      refill_bought_mb: Number(row.refill_bought_mb)
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[settingsProfile:putAdminImpersonatedVaultRefillQuota]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to set data quota' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/singles/set-token-balance
 * Body: { singlesId, account_balance_token } — Admin Tools; sets payment.account_balance_token (absolute).
 */
export async function postAdminSetSinglesTokenBalance(req, res) {
  const singlesId = Math.trunc(Number(req.body?.singlesId ?? req.body?.singles_id));
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  return adminSetTokenBalanceForSinglesId(req, res, singlesId);
}

export async function debitRequestedViewToken(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetSinglesId = Number(req.body?.target_singles_id);
  const viewKindRaw = String(req.body?.view_kind || '').trim().toLowerCase();
  const viewKind = viewKindRaw === 'detail' ? 'detail' : viewKindRaw === 'basic' ? 'basic' : null;
  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1 || !viewKind) {
    return res.status(400).json({ error: 'target_singles_id and view_kind are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockTokenBalanceInTxn(client, singlesId);
    const prefixPairResult = await client.query(
      `SELECT singles_id, prefix
       FROM helloworldjunktest.singles
       WHERE singles_id IN ($1, $2)`,
      [singlesId, targetSinglesId]
    );
    const currentPrefix = Number(prefixPairResult.rows.find((x) => Number(x.singles_id) === singlesId)?.prefix);
    const targetPrefix = Number(prefixPairResult.rows.find((x) => Number(x.singles_id) === targetSinglesId)?.prefix);
    const bypassTargetPrefixCheck = Number.isFinite(currentPrefix) && currentPrefix !== 0;
    if (!bypassTargetPrefixCheck) {
      if (!Number.isFinite(targetPrefix) || targetPrefix !== 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Error, user have not approved viewing bio.' });
      }
    }

    const resolvedSchema = await resolveRequestsAppSchema();
    const schemaCandidates = [...new Set([resolvedSchema, getDBSchema(), 'helloworldjunktest', 'public'].filter(Boolean))];
    let pickedSchema = null;
    let requestColumns = null;
    let requestRow = null;
    let requestIdColumn = null;
    let requestUpdatedAtColumn = null;

    for (const schemaName of schemaCandidates) {
      const cols = await getRequestColumns(client, schemaName);
      if (!cols.has('singles_id_from') || !cols.has('singles_id_to')) continue;
      const idColumn = cols.has('requests_id') ? 'requests_id' : cols.has('request_id') ? 'request_id' : null;
      const updatedAtColumn = cols.has('updated_at') ? 'updated_at' : null;
      if (!idColumn) continue;

      const reqRes = await client.query(
        `SELECT *
         FROM ${schemaName}.requests
         WHERE singles_id_from = $1
           AND singles_id_to = $2
         ORDER BY COALESCE(updated_at, created_at) DESC
         LIMIT 1
         FOR UPDATE`,
        [singlesId, targetSinglesId]
      );
      if (reqRes.rows.length) {
        pickedSchema = schemaName;
        requestColumns = cols;
        requestRow = reqRes.rows[0];
        requestIdColumn = idColumn;
        requestUpdatedAtColumn = updatedAtColumn;
        break;
      }
    }

    if (!pickedSchema || !requestColumns || !requestRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request row not found for this member' });
    }

    const paidColumn = viewKind === 'detail' ? REQUESTS_FULL_PAID_COLUMN : REQUESTS_BRIEF_PAID_COLUMN;
    if (!requestColumns.has(paidColumn)) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error:
          viewKind === 'detail'
            ? 'Missing full_paid column on requests table'
            : 'Missing brief_paid column on requests table'
      });
    }

    const paidAlready = parseBooleanEnumRaw(requestRow[paidColumn]);
    const debitTokens = paidAlready ? 0 : viewKind === 'detail' ? 2 : 1;

    if (!paidAlready) {
      const requestUpdates = [`${paidColumn} = ${sqlBooleanEnumLiteral(true, pickedSchema)}`];
      if (requestUpdatedAtColumn) requestUpdates.push('updated_at = CURRENT_TIMESTAMP');
      await client.query(
        `UPDATE ${pickedSchema}.requests
         SET ${requestUpdates.join(', ')}
         WHERE ${requestIdColumn} = $1`,
        [requestRow[requestIdColumn]]
      );
    }

    let tokenBalance = await getTokenBalance(client, singlesId);
    let paymentId = null;
    let transactionId = null;
    let debitDescription = '';
    let debitOccurredAt = null;
    if (debitTokens > 0) {
      if (tokenBalance < debitTokens) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient token balance' });
      }

      const paymentColumns = await getTableColumns(client, 'payment');
      const latestPaymentResult = await client.query(
        `SELECT payment_id, account_balance_token, paid_total_dollar, token_add_or_debit
         FROM helloworldjunktest.payment
         WHERE singles_id = $1
         ORDER BY payment_id DESC
         LIMIT 1`,
        [singlesId]
      );
      const latestPayment = latestPaymentResult.rows[0] || {};
      const prevBalance = toFiniteNumber(latestPayment?.account_balance_token, tokenBalance);
      const prevPaidDollar = toFiniteNumber(latestPayment?.paid_total_dollar, 0);
      const prevPaidToken = toFiniteNumber(latestPayment?.token_add_or_debit, 0);
      const nextBalance = prevBalance - debitTokens;
      if (nextBalance < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient token balance' });
      }
      const nextPaidToken = prevPaidToken - debitTokens;
      const now = new Date();

      const memberRes = await client.query(
        `SELECT singles_id, prefix, member_id, alias
         FROM helloworldjunktest.singles
         WHERE singles_id IN ($1, $2)`,
        [singlesId, targetSinglesId]
      );
      const target = memberRes.rows.find((x) => Number(x.singles_id) === targetSinglesId) || {};
      const memberLabel = formatMemberDisplayNumber(target.prefix, target.member_id) || formatMemberDisplayCode(targetSinglesId);
      const tokenWord = debitTokens === 1 ? 'token' : 'tokens';
      const viewKindWord = viewKind === 'detail' ? 'Detail' : 'Basic';
      const description = `Debit for viewing ${viewKindWord} member ${memberLabel}, -${debitTokens} ${tokenWord}`;
      debitDescription = description;
      debitOccurredAt = now;

      const insertColumns = [];
      const insertValues = [];
      const placeholders = [];
      const pushIfExists = (column, value) => {
        if (!paymentColumns.has(column)) return;
        if (insertColumns.includes(column)) return;
        insertColumns.push(column);
        insertValues.push(value);
        placeholders.push(`$${insertValues.length}`);
      };
      pushIfExists('singles_id', singlesId);
      pushIfExists('payment_history', description);
      pushIfExists('transaction_description', description);
      pushIfExists('account_balance_token', nextBalance);
      pushIfExists('paid_total_dollar', prevPaidDollar);
      pushIfExists('paid_total_token', nextPaidToken);
      pushIfExists('token_add_or_debit', -debitTokens);
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
      paymentId = Number(inserted.rows[0]?.payment_id);
      transactionId = await ensurePaymentTransactionId(client, paymentColumns, paymentId);

      const singlesColumns = await getSinglesColumns(client);
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

      tokenBalance = nextBalance;
    }

    await client.query('COMMIT');

    if (debitTokens > 0 && Number.isFinite(paymentId) && paymentId > 0) {
      sendPaymentReceiptEmailFireAndForget({
        singlesId,
        paymentId,
        transactionId,
        occurredAt: debitOccurredAt || new Date(),
        amountDollar: null,
        amountTokenDelta: -debitTokens,
        balanceToken: tokenBalance,
        description: debitDescription
      });
    }

    return res.json({
      ok: true,
      view_kind: viewKind,
      debited_tokens: debitTokens,
      paid_already: paidAlready,
      token_balance: tokenBalance,
      payment_id: Number.isFinite(paymentId) ? paymentId : null,
      transaction_id: transactionId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[settingsProfile:debitRequestedViewToken]', error);
    return res.status(500).json({ error: 'Failed to process token debit' });
  } finally {
    client.release();
  }
}

export async function getSettingsProfile(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    const columnSet = await getSinglesColumns(client);
    const selectedPairs = Object.entries(PROFILE_COLUMN_CANDIDATES)
      .map(([key, candidates]) => {
        const column = pickColumn(columnSet, candidates);
        return column ? { key, column } : null;
      })
      .filter(Boolean);

    const selectClause = selectedPairs.map((x) => `${x.column} AS ${x.key}`).join(', ');
    const sql = `SELECT ${selectClause} FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`;
    const profileResult = await client.query(sql, [singlesId]);
    if (!profileResult.rows.length) {
      return respondSessionInvalid(res);
    }

    const row = profileResult.rows[0];
    const resolvedReferCode = resolveProfileReferCode(row);
    if (resolvedReferCode && !normalizeSixDigitReferCode(row.my_refer_code)) {
      const referCol = pickColumn(columnSet, PROFILE_COLUMN_CANDIDATES.my_refer_code);
      if (referCol) {
        await client.query(
          `UPDATE helloworldjunktest.singles
           SET ${sqlIdent(referCol)} = $1
           WHERE singles_id = $2
             AND (${sqlIdent(referCol)} IS NULL OR BTRIM(${sqlIdent(referCol)}::text) = '')`,
          [resolvedReferCode, singlesId]
        );
      }
    }
    const tokenBalance = await getTokenBalance(client, singlesId);
    return res.json({
      id: row.id == null ? null : row.id,
      prefix: row.prefix == null ? null : Number(row.prefix),
      member_id: row.member_id == null ? null : row.member_id,
      alias: cleanNullableText(row.alias),
      firstname: cleanNullableText(row.firstname),
      lastname: cleanNullableText(row.lastname),
      mailing_firstname: cleanNullableText(row.mailing_firstname),
      mailing_middlename: cleanNullableText(row.mailing_middlename),
      mailing_lastname: cleanNullableText(row.mailing_lastname),
      email: cleanNullableText(row.email),
      phone: cleanNullableText(row.phone),
      mailing_address: cleanNullableText(row.mailing_address),
      mailing_street: cleanNullableText(row.mailing_street),
      mailing_city: cleanNullableText(row.mailing_city),
      mailing_zip: cleanNullableText(row.mailing_zip),
      mailing_country: cleanNullableText(row.mailing_country),
      profile_image_fk: row.profile_image_fk == null ? null : Number(row.profile_image_fk),
      my_refer_code: resolvedReferCode,
      token_balance: tokenBalance,
      last_password_change_date: formatLastChangeDateForApi(row.last_password_change_date),
      last_email_change_date: formatLastChangeDateForApi(row.last_email_change_date),
      last_phone_change_date: formatLastChangeDateForApi(row.last_phone_change_date),
      has_secret_icon: Boolean(String(row.secret_icon ?? '').trim()),
      custom_logout_duration: (() => {
        const n = Math.trunc(Number(row.custom_logout_duration));
        return Number.isFinite(n) && n > 0 ? n : 60;
      })()
    });
  } catch (error) {
    console.error('[settingsProfile:get]', error);
    return res.status(500).json({ error: 'Failed to load settings profile' });
  } finally {
    client.release();
  }
}

export async function updateSettingsProfile(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = req.body || {};
  const client = await pool.connect();
  try {
    const columnSet = await getSinglesColumns(client);
    const updates = [];
    const values = [];

    for (const [payloadKey, candidates] of Object.entries(PROFILE_COLUMN_CANDIDATES)) {
      if (payloadKey === 'profile_image_fk') continue;
      if (payloadKey === 'id') continue; // Show ID from DB, but never update primary identifier here.
      if (!Object.prototype.hasOwnProperty.call(payload, payloadKey)) continue;
      const column = pickColumn(columnSet, candidates);
      if (!column) continue;
      let nextValue = normalizeProfileValue(payload[payloadKey]);
      if (payloadKey === 'alias') {
        nextValue = cleanAlias(payload[payloadKey]);
        if (!nextValue) {
          nextValue = null;
        } else if (!isValidAliasFormat(nextValue)) {
          return res.status(400).json({ error: ALIAS_ALNUM_ONLY_MESSAGE });
        }
      }
      values.push(nextValue);
      updates.push(`${column} = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No updatable fields were provided' });
    }

    if (columnSet.has('updated_at')) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
    }

    values.push(singlesId);
    const result = await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $${values.length}
       RETURNING singles_id`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return getSettingsProfile(req, res);
  } catch (error) {
    console.error('[settingsProfile:put]', error);
    return res.status(500).json({ error: 'Failed to update settings profile' });
  } finally {
    client.release();
  }
}
