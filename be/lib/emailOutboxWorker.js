import os from 'os';
import nodemailer from 'nodemailer';
import pool from '../db/connection.js';
import { enrichMailOptions } from './emailHtml.js';

const LOG_PREFIX = '[email-outbox]';

function readIntEnv(name, fallback, min = 0) {
  const n = Number(String(process.env[name] ?? '').trim());
  return Number.isFinite(n) && n >= min ? Math.trunc(n) : fallback;
}

const POLL_MS = readIntEnv('EMAIL_OUTBOX_POLL_MS', 2000, 250);
const BATCH_SIZE = readIntEnv('EMAIL_OUTBOX_BATCH', 10, 1);
const MAX_ATTEMPTS = readIntEnv('EMAIL_OUTBOX_MAX_ATTEMPTS', 8, 1);
/** Cluster-wide cap across every web server (Gmail ≈ 500/day). 0 = no cap. */
const MAX_PER_HOUR = readIntEnv('EMAIL_OUTBOX_MAX_PER_HOUR', 0, 0);
const STALE_SENDING_MINUTES = 10;
const KEEP_SENT_DAYS = 30;
const REAP_EVERY_MS = 60 * 1000;

const WORKER_ID = `${os.hostname()}:${process.pid}`;

let pollTimer = null;
let reapTimer = null;
let ticking = false;
let transporter = null;
let warnedNoSmtp = false;

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: { user, pass }
    });
  }
  return transporter;
}

/** How many rows this tick may claim under EMAIL_OUTBOX_MAX_PER_HOUR. */
async function claimLimit() {
  if (!MAX_PER_HOUR) return BATCH_SIZE;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n
       FROM outdateddbsnapshotoct2024.email_outbox
      WHERE (status = 'sent' AND sent_at > now() - interval '1 hour') OR status = 'sending'`
  );
  return Math.max(0, Math.min(BATCH_SIZE, MAX_PER_HOUR - rows[0].n));
}

async function claimBatch(limit) {
  const { rows } = await pool.query(
    `UPDATE outdateddbsnapshotoct2024.email_outbox
        SET status = 'sending', locked_by = $1, locked_at = now(), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM outdateddbsnapshotoct2024.email_outbox
         WHERE status = 'pending' AND run_at <= now()
         ORDER BY run_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED)
      RETURNING id, mail_options, attempts`,
    [WORKER_ID, limit]
  );
  return rows;
}

async function markSent(id) {
  await pool.query(
    `UPDATE outdateddbsnapshotoct2024.email_outbox
        SET status = 'sent', sent_at = now(), locked_by = NULL, locked_at = NULL, last_error = NULL
      WHERE id = $1`,
    [id]
  );
}

/** Retry after 2, 4, 8 … minutes (capped at 4h); dead after MAX_ATTEMPTS. */
async function markFailed(row, err) {
  const dead = row.attempts >= MAX_ATTEMPTS;
  const delayMinutes = Math.min(2 ** row.attempts, 240);
  await pool.query(
    `UPDATE outdateddbsnapshotoct2024.email_outbox
        SET status = $2,
            run_at = now() + make_interval(mins => $3),
            locked_by = NULL, locked_at = NULL,
            last_error = $4
      WHERE id = $1`,
    [row.id, dead ? 'dead' : 'pending', delayMinutes, String(err?.message ?? err).slice(0, 2000)]
  );
  console.error(
    `${LOG_PREFIX} id=${row.id} attempt ${row.attempts}/${MAX_ATTEMPTS} failed${dead ? ' — DEAD' : ''}:`,
    err?.message ?? err
  );
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const smtp = getTransporter();
    if (!smtp) {
      if (!warnedNoSmtp) console.warn(`${LOG_PREFIX} SMTP_USER / SMTP_PASS not set — emails stay queued`);
      warnedNoSmtp = true;
      return;
    }
    const limit = await claimLimit();
    if (!limit) return;
    const rows = await claimBatch(limit);
    for (const row of rows) {
      try {
        await smtp.sendMail(enrichMailOptions(row.mail_options));
        await markSent(row.id);
      } catch (err) {
        await markFailed(row, err).catch((e) => console.error(`${LOG_PREFIX} mark failed:`, e?.message ?? e));
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} poll failed:`, err?.message ?? err);
  } finally {
    ticking = false;
  }
}

/** Requeue rows whose worker died mid-send; prune old sent rows. */
async function reap() {
  try {
    const stale = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.email_outbox
          SET status = 'pending', locked_by = NULL, locked_at = NULL,
              last_error = COALESCE(last_error, 'requeued: worker stopped mid-send')
        WHERE status = 'sending' AND locked_at < now() - make_interval(mins => $1)`,
      [STALE_SENDING_MINUTES]
    );
    if (stale.rowCount) console.warn(`${LOG_PREFIX} requeued ${stale.rowCount} stale 'sending' row(s)`);
    await pool.query(
      `DELETE FROM outdateddbsnapshotoct2024.email_outbox
        WHERE status = 'sent' AND sent_at < now() - make_interval(days => $1)`,
      [KEEP_SENT_DAYS]
    );
  } catch (err) {
    console.error(`${LOG_PREFIX} reap failed:`, err?.message ?? err);
  }
}

/** Runs in every BE process on every web server; SKIP LOCKED keeps them from double-sending. */
export function startEmailOutboxWorker() {
  if (pollTimer) return;
  pollTimer = setInterval(() => void tick(), POLL_MS);
  reapTimer = setInterval(() => void reap(), REAP_EVERY_MS);
  pollTimer.unref?.();
  reapTimer.unref?.();
  void reap();
  console.log(
    `${LOG_PREFIX} worker ${WORKER_ID} polling every ${POLL_MS}ms (batch ${BATCH_SIZE}, max ${MAX_ATTEMPTS} attempts${
      MAX_PER_HOUR ? `, ${MAX_PER_HOUR}/hour cap` : ''
    })`
  );
}

export function stopEmailOutboxWorker() {
  clearInterval(pollTimer);
  clearInterval(reapTimer);
  pollTimer = null;
  reapTimer = null;
}
