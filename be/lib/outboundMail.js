import pool from '../db/connection.js';
import { EMAIL_LOGO_CID, enrichMailOptions } from './emailHtml.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Flatten any nodemailer address field ("A <a@b>", ["a@b"], {address}) to lowercase addresses. */
function extractAddresses(field) {
  const found = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      visit(value.address);
      return;
    }
    for (const part of String(value).split(',')) {
      const raw = part.trim();
      if (!raw) continue;
      const angled = raw.match(/<([^>]+)>/);
      const address = (angled ? angled[1] : raw).trim().toLowerCase();
      if (EMAIL_PATTERN.test(address)) found.push(address);
    }
  };
  visit(field);
  return found;
}

function toArrayField(value) {
  if (value == null) return [];
  return Array.isArray(value) ? [...value] : [value];
}

async function lookupAltEmails(mainEmails) {
  const { rows } = await pool.query(
    `SELECT DISTINCT LOWER(BTRIM(alt_email)) AS alt_email
       FROM outdateddbsnapshotoct2024.singles
      WHERE LOWER(email) = ANY($1::text[])
        AND alt_email IS NOT NULL
        AND BTRIM(alt_email) <> ''`,
    [mainEmails]
  );
  return rows.map((r) => String(r.alt_email || '').trim()).filter((a) => EMAIL_PATTERN.test(a));
}

/**
 * CC singles.alt_email for every recipient whose address matches singles.email.
 * Non-members and members without an alt address are left untouched.
 */
export async function addAltEmailCopies(mailOptions) {
  const recipients = extractAddresses(mailOptions?.to);
  if (!recipients.length) return mailOptions;

  let altEmails = [];
  try {
    altEmails = await lookupAltEmails(recipients);
  } catch (err) {
    console.error('[outboundMail] alt_email lookup failed:', err?.message ?? err);
    return mailOptions;
  }
  if (!altEmails.length) return mailOptions;

  const alreadyAddressed = new Set([
    ...recipients,
    ...extractAddresses(mailOptions.cc),
    ...extractAddresses(mailOptions.bcc)
  ]);
  const additions = [...new Set(altEmails)].filter((a) => !alreadyAddressed.has(a));
  if (!additions.length) return mailOptions;

  return { ...mailOptions, cc: [...toArrayField(mailOptions.cc), ...additions] };
}

/** EMAIL_QUEUE_ENABLED=0 in ~/.ssh/be/.env sends inline (old behavior); default queues. */
export function isEmailQueueEnabled() {
  return String(process.env.EMAIL_QUEUE_ENABLED ?? '1').trim() !== '0';
}

/** Attachments go into jsonb — Buffers become base64; the inline logo is re-added at send time. */
function toQueueableMailOptions(mailOptions) {
  const attachments = toArrayField(mailOptions.attachments)
    .filter((a) => a?.cid !== EMAIL_LOGO_CID)
    .map((a) =>
      Buffer.isBuffer(a?.content) ? { ...a, content: a.content.toString('base64'), encoding: 'base64' } : a
    );
  const { attachments: _drop, ...rest } = mailOptions;
  return attachments.length ? { ...rest, attachments } : rest;
}

/**
 * Queue one email in outdateddbsnapshotoct2024.email_outbox (Primary).
 * @param {object} mailOptions nodemailer options
 * @param {{ client?: import('pg').PoolClient, dedupeKey?: string, runAt?: Date }} [opts]
 *   client — enqueue inside the caller's transaction; dedupeKey — skip if already queued.
 * @returns {Promise<{ queued: boolean, id: number | null }>}
 */
export async function enqueueOutboundMail(mailOptions, { client, dedupeKey, runAt } = {}) {
  const withAlt = await addAltEmailCopies(mailOptions);
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO outdateddbsnapshotoct2024.email_outbox (mail_options, dedupe_key, run_at)
     VALUES ($1::jsonb, $2, COALESCE($3::timestamptz, now()))
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [JSON.stringify(toQueueableMailOptions(withAlt)), dedupeKey || null, runAt || null]
  );
  return { queued: rows.length > 0, id: rows[0]?.id ?? null };
}

/**
 * Single send path for all transactional mail. Queues to email_outbox (sent by
 * emailOutboxWorker on any web server); `transporter` is only used when the queue is disabled.
 */
export async function sendOutboundMail(transporter, mailOptions, opts) {
  if (!isEmailQueueEnabled()) {
    return transporter.sendMail(await addAltEmailCopies(enrichMailOptions(mailOptions)));
  }
  return enqueueOutboundMail(mailOptions, opts);
}
