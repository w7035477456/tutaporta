/**
 * Auto Scan Emails — TutaNotes Bill Schedule.
 *
 * Members forward bill mail (Gmail filter) to bills+<inbox_token>@tutamall.com. Google Workspace
 * plus-addressing drops it in the bills@ mailbox, which this module reads over IMAP:
 *   stage 1  keyword filter, no AI
 *   stage 2  local Ollama reads the email → strict JSON
 *   stage 3  plain code decides monthly vs yearly from date gaps per merchant
 * Bills become pending Monthly/Yearly rows (email_scan_pending = true) until the member clicks
 * Approve. The raw email is deleted from the mailbox after processing; only extracted fields
 * are kept in outdateddbsnapshotoct2024.email_scan.
 *
 * Cluster-safe: one run at a time across all app servers via a Postgres advisory lock.
 */
import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pool from '../db/connection.js';
import { ensureMonthCloned } from '../routes/recordVault/monthlyBillRoutes.js';
import { ensureYearCloned } from '../routes/recordVault/yearlyBillRoutes.js';

const LOG = '[email-scan]';
const ADVISORY_LOCK_KEY = 77120261;
const MAX_MESSAGES_PER_RUN = 50;
const LLM_BODY_MAX_CHARS = 6000;
/** Only recent mail is header-checked each run, so a busy shared inbox stays cheap. */
const SEARCH_WINDOW_DAYS = 14;

export function getEmailScanConfig() {
  const env = process.env;
  const pollMinutes = Number(env.EMAIL_SCAN_POLL_MINUTES);
  return {
    enabled: String(env.EMAIL_SCAN_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    imapHost: String(env.EMAIL_SCAN_IMAP_HOST || 'imap.gmail.com').trim(),
    imapPort: Number(env.EMAIL_SCAN_IMAP_PORT) || 993,
    imapUser: String(env.EMAIL_SCAN_IMAP_USER || '').trim(),
    imapPass: String(env.EMAIL_SCAN_IMAP_PASS || '').trim(),
    addressLocal: String(env.EMAIL_SCAN_ADDRESS_LOCAL || 'bills').trim().toLowerCase(),
    addressDomain: String(env.EMAIL_SCAN_ADDRESS_DOMAIN || 'tutamall.com').trim().toLowerCase(),
    pollMinutes: Number.isFinite(pollMinutes) && pollMinutes > 0 ? pollMinutes : 5,
    ollamaBaseUrl: String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    ollamaModel: String(env.EMAIL_SCAN_OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen2.5:7b').trim(),
    llmTimeoutMs: Number(env.EMAIL_SCAN_LLM_TIMEOUT_MS) || 180000
  };
}

export function isEmailScanConfigured(cfg = getEmailScanConfig()) {
  return cfg.enabled && Boolean(cfg.imapUser && cfg.imapPass);
}

export function forwardingAddressFor(token, cfg = getEmailScanConfig()) {
  return `${cfg.addressLocal}+${token}@${cfg.addressDomain}`;
}

/** Gmail "Has the words" filter text shown in the setup popup (stage 1 runs the same idea server-side). */
export const GMAIL_FILTER_HAS_WORDS =
  '{invoice receipt "payment received" "payment due" "amount due" "your bill" "billing statement" ' +
  'autopay "auto-pay" "automatic payment" subscription renewal membership "payment confirmation" ' +
  '"statement is ready" "bill is ready"}';

// ---------------------------------------------------------------- stage 1: keyword filter (no AI)

const BILL_KEYWORDS = [
  'invoice',
  'receipt',
  'payment',
  'autopay',
  'auto-pay',
  'auto pay',
  'subscription',
  'renewal',
  'renews',
  'statement',
  'amount due',
  'your bill',
  'bill is ready',
  'billing',
  'charged',
  'membership',
  'premium',
  'due date',
  'balance due',
  'minimum due'
];

const MARKETING_SUBJECT = /(\d+%\s*off|\bsale\b|\bdeal(s)?\b|\bwebinar\b|\bnewsletter\b|\bpromo\b|\bcoupon\b|\bfree shipping\b)/i;

export function stage1KeywordFilter({ subject, text }) {
  const subj = String(subject || '').toLowerCase();
  const body = String(text || '').slice(0, 20000).toLowerCase();
  const subjectHit = BILL_KEYWORDS.some((k) => subj.includes(k));
  const bodyHit = subjectHit || BILL_KEYWORDS.some((k) => body.includes(k));
  if (!bodyHit) return { pass: false, reason: 'no bill keywords' };
  if (!subjectHit && MARKETING_SUBJECT.test(subj)) return { pass: false, reason: 'marketing' };
  return { pass: true };
}

// ---------------------------------------------------------------- stage 2: LLM JSON extract

const LLM_SYSTEM_PROMPT = `You read one email and decide whether it is a bill, invoice, payment receipt, subscription or membership charge for the recipient.
Reply with ONLY one JSON object, no prose, using exactly these keys:
{"is_bill": boolean, "merchant": string, "amount": number|null, "bill_date": "YYYY-MM-DD"|null, "due_date": "YYYY-MM-DD"|null, "kind": "utility"|"subscription"|"membership"|"insurance"|"loan"|"credit_card"|"rent"|"phone_internet"|"other", "autopay": boolean, "billing_period": "monthly"|"yearly"|"unknown", "confidence": number}
Rules:
- merchant: short company name only (e.g. "Meetup", "SDG&E", "Progressive"), no "Inc." or email addresses.
- amount: total charged or due in dollars, digits only (e.g. 14.99). null if not stated.
- bill_date: date of the charge, statement or invoice. due_date: payment due date if stated.
- autopay: true only if the email says it was or will be paid automatically.
- Marketing, shipping notices, password resets and newsletters are is_bill=false.
- confidence: 0 to 1.`;

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#36;/g, '$')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function parseLlmJson(raw) {
  const s = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LLM reply had no JSON object');
  return JSON.parse(s.slice(start, end + 1));
}

function toIsoDate(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  return s;
}

function normalizeExtract(obj) {
  const amountNum = Number(String(obj?.amount ?? '').replace(/[$,\s]/g, ''));
  const confidence = Number(obj?.confidence);
  const period = String(obj?.billing_period || '').toLowerCase();
  return {
    is_bill: obj?.is_bill === true,
    merchant: String(obj?.merchant || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    amount: Number.isFinite(amountNum) && amountNum > 0 && amountNum < 1e9 ? Math.round(amountNum * 100) / 100 : null,
    bill_date: toIsoDate(obj?.bill_date),
    due_date: toIsoDate(obj?.due_date),
    kind: String(obj?.kind || 'other').toLowerCase().slice(0, 40),
    autopay: obj?.autopay === true,
    billing_period: ['monthly', 'yearly'].includes(period) ? period : 'unknown',
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null
  };
}

class LlmUnavailableError extends Error {}

async function ollamaChat(cfg, body) {
  let res;
  try {
    res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.llmTimeoutMs)
    });
  } catch (err) {
    throw new LlmUnavailableError(`Ollama unreachable at ${cfg.ollamaBaseUrl}: ${err?.message || err}`);
  }
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

export async function stage2LlmExtract({ from, subject, date, text }, cfg = getEmailScanConfig()) {
  const userContent = [
    `From: ${from}`,
    `Subject: ${subject}`,
    `Date: ${date ? new Date(date).toISOString().slice(0, 10) : 'unknown'}`,
    '',
    String(text || '').slice(0, LLM_BODY_MAX_CHARS)
  ].join('\n');
  const body = {
    model: cfg.ollamaModel,
    stream: false,
    format: 'json',
    think: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '10m',
    options: { temperature: 0 },
    messages: [
      { role: 'system', content: LLM_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ]
  };
  let reply = await ollamaChat(cfg, body);
  if (!reply.ok && reply.status === 400 && /think/i.test(reply.text)) {
    delete body.think;
    reply = await ollamaChat(cfg, body);
  }
  if (!reply.ok) {
    if (reply.status === 404) throw new LlmUnavailableError(`Ollama model ${cfg.ollamaModel} not found`);
    throw new Error(`Ollama HTTP ${reply.status}: ${reply.text.slice(0, 200)}`);
  }
  const content = JSON.parse(reply.text)?.message?.content;
  return normalizeExtract(parseLlmJson(content));
}

// ---------------------------------------------------------------- stage 3: cadence in code

export function merchantKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(inc|llc|corp|co|ltd|the|com)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

/** Median gap between distinct charge dates: ~30 days → monthly, ~365 → yearly; else LLM hint; else monthly. */
export function stage3DecideCadence(dates, llmHint) {
  const uniq = [...new Set(dates.filter(Boolean))].sort();
  if (uniq.length >= 2) {
    const gaps = [];
    for (let i = 1; i < uniq.length; i += 1) {
      const g = daysBetween(uniq[i - 1], uniq[i]);
      if (g >= 7) gaps.push(g);
    }
    if (gaps.length) {
      gaps.sort((x, y) => x - y);
      const median = gaps[Math.floor(gaps.length / 2)];
      if (median >= 20 && median <= 45) return 'monthly';
      if (median >= 300 && median <= 420) return 'yearly';
    }
  }
  if (llmHint === 'yearly') return 'yearly';
  return 'monthly';
}

async function priorChargeDates(client, singlesId, key) {
  if (!key) return [];
  const { rows } = await client.query(
    `SELECT merchant, to_char(COALESCE(bill_date, due_date), 'YYYY-MM-DD') AS d
       FROM outdateddbsnapshotoct2024.email_scan
      WHERE singles_id = $1 AND is_bill IS TRUE
        AND COALESCE(bill_date, due_date) IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 500`,
    [singlesId]
  );
  return rows.filter((r) => merchantKey(r.merchant) === key).map((r) => r.d);
}

// ---------------------------------------------------------------- add pending rows

function formatAmount(n) {
  if (n == null) return '';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function descriptionMatches(desc, key) {
  const d = merchantKey(desc);
  if (!d || !key) return false;
  if (d.includes(key)) return true;
  return key.length >= 4 && d.length >= 4 && key.includes(d);
}

/** Inserts a pending row into the current month (monthly) or current year (yearly). */
async function addPendingBillRow(client, { singlesId, storageBackend, cadence, extract, now = new Date() }) {
  const key = merchantKey(extract.merchant);
  const refDate = extract.due_date || extract.bill_date;
  const refDay = refDate ? Number(refDate.slice(8, 10)) : null;
  const refMonth = refDate ? Number(refDate.slice(5, 7)) : null;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const amount = formatAmount(extract.amount);
  const billType = extract.autopay ? 'Auto' : 'Manual';

  if (cadence === 'yearly') {
    await ensureYearCloned(client, singlesId, year, storageBackend);
    const { rows: existing } = await client.query(
      `SELECT bill_description, row_index FROM outdateddbsnapshotoct2024.yearly_bill
        WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $3`,
      [singlesId, storageBackend, year]
    );
    if (existing.some((r) => descriptionMatches(r.bill_description, key))) return { duplicate: true };
    const nextIndex = existing.reduce((m, r) => Math.max(m, Number(r.row_index) || 0), 0) + 1;
    await client.query(
      `INSERT INTO outdateddbsnapshotoct2024.yearly_bill (
         singles_id, storage_backend, bill_year, bill_month, row_index,
         bill_description, due_month_day, amount, bill_type, email_scan_pending
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [singlesId, storageBackend, year, refMonth, nextIndex, extract.merchant, refDay, amount, billType]
    );
    return { duplicate: false, kind: 'yearly', year, month: null };
  }

  await ensureMonthCloned(client, singlesId, year, month, storageBackend);
  const { rows: existing } = await client.query(
    `SELECT bill_description, row_index FROM outdateddbsnapshotoct2024.monthly_bill
      WHERE singles_id = $1 AND storage_backend = $2 AND bill_year = $3 AND bill_month = $4`,
    [singlesId, storageBackend, year, month]
  );
  if (existing.some((r) => descriptionMatches(r.bill_description, key))) return { duplicate: true };
  const nextIndex = existing.reduce((m, r) => Math.max(m, Number(r.row_index) || 0), 0) + 1;
  await client.query(
    `INSERT INTO outdateddbsnapshotoct2024.monthly_bill (
       singles_id, storage_backend, bill_year, bill_month, row_index,
       bill_description, due_day, amount, bill_type, email_scan_pending
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
    [singlesId, storageBackend, year, month, nextIndex, extract.merchant, refDay, amount, billType]
  );
  return { duplicate: false, kind: 'monthly', year, month };
}

// ---------------------------------------------------------------- per-message pipeline

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TOKEN_HEADERS = ['delivered-to', 'x-original-to', 'x-forwarded-to', 'x-forwarded-for', 'to', 'cc', 'envelope-to'];

/** gmail.com ignores dots in the local part, so support.tuta+x and supporttuta+x are the same mailbox. */
function tokenRegex(cfg) {
  const gmail = /^(gmail|googlemail)\.com$/.test(cfg.addressDomain);
  const local = gmail
    ? cfg.addressLocal.replace(/\./g, '').split('').map(escapeRegex).join('\\.?')
    : escapeRegex(cfg.addressLocal);
  return new RegExp(`${local}\\+([a-z0-9]{8,32})@${escapeRegex(cfg.addressDomain)}`, 'i');
}

/** Token from raw header text (IMAP header-only fetch), or null when the mail is not for Auto Scan. */
export function findInboxTokenInHeaderText(headerText, cfg = getEmailScanConfig()) {
  const m = tokenRegex(cfg).exec(String(headerText || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Finds bills+<token>@domain in Delivered-To / To / Cc / X-Original-To / X-Forwarded-To/For. */
export function findInboxToken(parsed, cfg = getEmailScanConfig()) {
  const re = tokenRegex(cfg);
  const wanted = new Set(TOKEN_HEADERS);
  for (const h of parsed?.headerLines || []) {
    if (!wanted.has(String(h.key).toLowerCase())) continue;
    const m = re.exec(String(h.line || ''));
    if (m) return m[1].toLowerCase();
  }
  return null;
}

function detectGmailConfirmation(parsed, text) {
  const from = String(parsed?.from?.text || '').toLowerCase();
  const subject = String(parsed?.subject || '');
  if (!from.includes('forwarding-noreply@google.com') && !/forwarding confirmation/i.test(subject)) return null;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(text)?.[1] || /\b(\d{9})\b/.exec(text)?.[1] || null;
  const url = /https:\/\/(?:mail-settings|mail)\.google\.com\/[^\s<>"')]+/i.exec(text)?.[0] || null;
  return { code, url };
}

function contentHash(parsed, text) {
  return crypto
    .createHash('sha256')
    .update(`${parsed?.messageId || ''}\n${parsed?.subject || ''}\n${String(text || '').slice(0, 50000)}`)
    .digest('hex');
}

async function insertScanRow(client, row) {
  const { rows } = await client.query(
    `INSERT INTO outdateddbsnapshotoct2024.email_scan (
       singles_id, content_hash, from_address, subject, received_at, stage,
       is_bill, merchant, amount, bill_date, due_date, kind, autopay, confidence,
       cadence, added_kind, added_year, added_month, llm_model,
       gmail_confirm_code, gmail_confirm_url, error
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT (singles_id, content_hash) DO NOTHING
     RETURNING email_scan_id`,
    [
      row.singles_id,
      row.content_hash,
      String(row.from_address || '').slice(0, 320),
      String(row.subject || '').slice(0, 300),
      row.received_at || null,
      row.stage,
      row.is_bill ?? null,
      row.merchant ?? null,
      row.amount ?? null,
      row.bill_date ?? null,
      row.due_date ?? null,
      row.kind ?? null,
      row.autopay ?? null,
      row.confidence ?? null,
      row.cadence ?? null,
      row.added_kind ?? null,
      row.added_year ?? null,
      row.added_month ?? null,
      row.llm_model ?? null,
      row.gmail_confirm_code ?? null,
      row.gmail_confirm_url ?? null,
      row.error ? String(row.error).slice(0, 500) : null
    ]
  );
  return rows.length > 0;
}

async function alreadyScanned(client, singlesId, hash) {
  const { rows } = await client.query(
    `SELECT 1 FROM outdateddbsnapshotoct2024.email_scan WHERE singles_id = $1 AND content_hash = $2`,
    [singlesId, hash]
  );
  return rows.length > 0;
}

/**
 * Runs stages 1–3 for one parsed email. Returns { deleteRaw } — false only when the LLM is down,
 * so the email stays in the mailbox for the next run.
 */
export async function processParsedEmail(client, parsed, cfg = getEmailScanConfig()) {
  const token = findInboxToken(parsed, cfg);
  if (!token) {
    // Shared mailbox (e.g. support inbox): mail not sent to a +token address is never touched.
    return { deleteRaw: false, stage: 'no_token' };
  }
  const { rows: inboxRows } = await client.query(
    `SELECT singles_id, storage_backend, enabled
       FROM outdateddbsnapshotoct2024.email_scan_inbox
      WHERE inbox_token = $1`,
    [token]
  );
  const inbox = inboxRows[0];
  if (!inbox || !inbox.enabled) {
    console.warn(`${LOG} unknown/disabled inbox token — discarding`);
    return { deleteRaw: true, stage: 'unknown_token' };
  }
  const singlesId = Number(inbox.singles_id);
  const text = parsed.text?.trim() ? parsed.text : stripHtml(parsed.html || parsed.textAsHtml || '');
  const hash = contentHash(parsed, text);
  if (await alreadyScanned(client, singlesId, hash)) return { deleteRaw: true, stage: 'seen' };

  const base = {
    singles_id: singlesId,
    content_hash: hash,
    from_address: parsed.from?.value?.[0]?.address || parsed.from?.text || '',
    subject: parsed.subject || '',
    received_at: parsed.date || null
  };

  const confirm = detectGmailConfirmation(parsed, text);
  if (confirm) {
    await insertScanRow(client, {
      ...base,
      stage: 'gmail_confirm',
      gmail_confirm_code: confirm.code,
      gmail_confirm_url: confirm.url
    });
    return { deleteRaw: true, stage: 'gmail_confirm' };
  }

  const s1 = stage1KeywordFilter({ subject: parsed.subject, text });
  if (!s1.pass) {
    await insertScanRow(client, { ...base, stage: 'filtered_out', error: s1.reason });
    return { deleteRaw: true, stage: 'filtered_out' };
  }

  let extract;
  try {
    extract = await stage2LlmExtract(
      { from: base.from_address, subject: base.subject, date: base.received_at, text },
      cfg
    );
  } catch (err) {
    if (err instanceof LlmUnavailableError) throw err;
    await insertScanRow(client, { ...base, stage: 'error', llm_model: cfg.ollamaModel, error: err?.message || String(err) });
    return { deleteRaw: true, stage: 'error' };
  }

  const llmFields = {
    is_bill: extract.is_bill,
    merchant: extract.merchant || null,
    amount: extract.amount,
    bill_date: extract.bill_date,
    due_date: extract.due_date,
    kind: extract.kind,
    autopay: extract.autopay,
    confidence: extract.confidence,
    llm_model: cfg.ollamaModel
  };
  if (!extract.is_bill || !extract.merchant) {
    await insertScanRow(client, { ...base, ...llmFields, stage: 'not_bill' });
    return { deleteRaw: true, stage: 'not_bill' };
  }

  const key = merchantKey(extract.merchant);
  const thisDate = extract.bill_date || extract.due_date;
  const dates = [...(await priorChargeDates(client, singlesId, key)), thisDate];
  const cadence = stage3DecideCadence(dates, extract.billing_period);

  await client.query('BEGIN');
  try {
    const added = await addPendingBillRow(client, {
      singlesId,
      storageBackend: inbox.storage_backend === 'usb' ? 'usb' : 'onedrive',
      cadence,
      extract
    });
    await insertScanRow(client, {
      ...base,
      ...llmFields,
      cadence,
      stage: added.duplicate ? 'duplicate' : 'added',
      added_kind: added.duplicate ? null : added.kind,
      added_year: added.duplicate ? null : added.year,
      added_month: added.duplicate ? null : added.month
    });
    await client.query('COMMIT');
    return { deleteRaw: true, stage: added.duplicate ? 'duplicate' : 'added' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------- IMAP run + lock

async function findTrashPath(imap) {
  const boxes = await imap.list();
  return boxes.find((b) => b.specialUse === '\\Trash')?.path || '[Gmail]/Trash';
}

/** Gmail: move to Trash, then delete from Trash = permanent delete. */
async function deleteRawEmail(imap, uid, trashPath) {
  try {
    const moved = await imap.messageMove(String(uid), trashPath, { uid: true });
    const newUid = moved?.uidMap?.get(Number(uid));
    if (newUid) {
      const lock = await imap.getMailboxLock(trashPath);
      try {
        await imap.messageDelete(String(newUid), { uid: true });
      } finally {
        lock.release();
      }
      await imap.mailboxOpen('INBOX');
    }
  } catch (err) {
    console.warn(`${LOG} trash-move failed, falling back to delete:`, err?.message || err);
    await imap.messageDelete(String(uid), { uid: true });
  }
}

export async function isEmailScanRunning() {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_locks
        WHERE locktype = 'advisory' AND classid = 0 AND objid = $1 AND granted
     ) AS running`,
    [ADVISORY_LOCK_KEY]
  );
  return Boolean(rows[0]?.running);
}

/** One pass over the bills@ mailbox. Safe to call from any app server; only one runs at a time. */
export async function runEmailScanOnce() {
  const cfg = getEmailScanConfig();
  if (!isEmailScanConfigured(cfg)) return { ok: false, skipped: true, reason: 'not_configured' };

  const client = await pool.connect();
  let locked = false;
  const counts = {};
  try {
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY]);
    locked = Boolean(lockRes.rows[0]?.ok);
    if (!locked) return { ok: true, skipped: true, reason: 'lock' };

    const imap = new ImapFlow({
      host: cfg.imapHost,
      port: cfg.imapPort,
      secure: true,
      auth: { user: cfg.imapUser, pass: cfg.imapPass },
      logger: false
    });
    await imap.connect();
    try {
      const trashPath = await findTrashPath(imap);
      await imap.mailboxOpen('INBOX');
      const since = new Date(Date.now() - SEARCH_WINDOW_DAYS * 86400000);
      const recentUids = (await imap.search({ since }, { uid: true })) || [];
      const matched = [];
      if (recentUids.length) {
        for await (const m of imap.fetch(recentUids.join(','), { uid: true, headers: TOKEN_HEADERS }, { uid: true })) {
          if (findInboxTokenInHeaderText(m.headers?.toString('utf8'), cfg)) matched.push(m.uid);
        }
      }
      const uids = matched.slice(0, MAX_MESSAGES_PER_RUN);
      for (const uid of uids) {
        const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg?.source) continue;
        let result;
        try {
          const parsed = await simpleParser(msg.source);
          result = await processParsedEmail(client, parsed, cfg);
        } catch (err) {
          if (err instanceof LlmUnavailableError) {
            console.warn(`${LOG} ${err.message} — leaving remaining mail for next run`);
            counts.llm_unavailable = 1;
            break;
          }
          console.error(`${LOG} message uid ${uid} failed:`, err?.message || err);
          result = { deleteRaw: true, stage: 'error' };
        }
        counts[result.stage] = (counts[result.stage] || 0) + 1;
        if (result.deleteRaw) await deleteRawEmail(imap, uid, trashPath);
      }
    } finally {
      await imap.logout().catch(() => {});
    }
    if (Object.keys(counts).length) console.log(`${LOG} run done`, counts);
    return { ok: true, counts };
  } catch (err) {
    console.error(`${LOG} run failed:`, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

let pollTimer = null;

export function startEmailScanPoller() {
  const cfg = getEmailScanConfig();
  if (!isEmailScanConfigured(cfg)) {
    console.log(`${LOG} poller off (set EMAIL_SCAN_IMAP_USER / EMAIL_SCAN_IMAP_PASS to enable)`);
    return;
  }
  if (pollTimer) return;
  const tick = () => {
    void runEmailScanOnce();
  };
  setTimeout(tick, 60 * 1000).unref?.();
  pollTimer = setInterval(tick, cfg.pollMinutes * 60 * 1000);
  pollTimer.unref?.();
  console.log(`${LOG} poller every ${cfg.pollMinutes} min (${cfg.imapUser}, model ${cfg.ollamaModel})`);
}
