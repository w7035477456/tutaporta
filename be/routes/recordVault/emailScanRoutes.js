import crypto from 'crypto';
import pool from '../../db/connection.js';
import { readBillStorageBackend } from '../../utils/billScheduleStorageBackend.js';
import {
  GMAIL_FILTER_HAS_WORDS,
  forwardingAddressFor,
  getEmailScanConfig,
  isEmailScanConfigured,
  isEmailScanRunning,
  runEmailScanOnce
} from '../../utils/emailScan.js';

function requireSinglesId(req) {
  const n = Math.trunc(Number(req.auth?.singles_id));
  if (!Number.isFinite(n) || n < 1) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  return n;
}

function sendError(res, err) {
  const statusCode = Number(err?.statusCode) || 500;
  let message = err?.message || 'Email scan request failed';
  if (String(err?.code) === '42P01' || String(err?.code) === '42703') {
    message = 'Email scan tables are missing. On Postgres run: be/db/createEmailScan.sql';
  }
  if (statusCode >= 500) console.error('[email-scan]', err?.message, err?.code || '');
  return res.status(statusCode).json({ error: message });
}

function newToken() {
  return crypto.randomBytes(9).toString('hex');
}

async function ensureInbox(singlesId, storageBackend) {
  const { rows } = await pool.query(
    `SELECT inbox_token, storage_backend, enabled
       FROM outdateddbsnapshotoct2024.email_scan_inbox WHERE singles_id = $1`,
    [singlesId]
  );
  if (rows[0]) {
    if (rows[0].storage_backend !== storageBackend) {
      await pool.query(
        `UPDATE outdateddbsnapshotoct2024.email_scan_inbox
            SET storage_backend = $2, updated_at = now() WHERE singles_id = $1`,
        [singlesId, storageBackend]
      );
    }
    return { ...rows[0], storage_backend: storageBackend };
  }
  const { rows: inserted } = await pool.query(
    `INSERT INTO outdateddbsnapshotoct2024.email_scan_inbox (singles_id, inbox_token, storage_backend)
     VALUES ($1, $2, $3)
     ON CONFLICT (singles_id) DO UPDATE SET updated_at = now()
     RETURNING inbox_token, storage_backend, enabled`,
    [singlesId, newToken(), storageBackend]
  );
  return inserted[0];
}

async function loadRecent(singlesId) {
  const { rows } = await pool.query(
    `SELECT email_scan_id, from_address, subject, received_at, stage, merchant, amount,
            to_char(bill_date, 'YYYY-MM-DD') AS bill_date, to_char(due_date, 'YYYY-MM-DD') AS due_date,
            cadence, added_kind, autopay, confidence, error, created_at
       FROM outdateddbsnapshotoct2024.email_scan
      WHERE singles_id = $1 AND stage <> 'gmail_confirm'
      ORDER BY created_at DESC
      LIMIT 25`,
    [singlesId]
  );
  return rows.map((r) => ({ ...r, amount: r.amount != null ? Number(r.amount) : null }));
}

async function loadGmailConfirm(singlesId) {
  const { rows } = await pool.query(
    `SELECT gmail_confirm_code, gmail_confirm_url, created_at
       FROM outdateddbsnapshotoct2024.email_scan
      WHERE singles_id = $1 AND stage = 'gmail_confirm' AND created_at > now() - interval '7 days'
      ORDER BY created_at DESC
      LIMIT 1`,
    [singlesId]
  );
  const r = rows[0];
  return r ? { code: r.gmail_confirm_code, url: r.gmail_confirm_url, created_at: r.created_at } : null;
}

async function statusPayload(singlesId, inbox) {
  const cfg = getEmailScanConfig();
  const [running, recent, gmailConfirm] = await Promise.all([
    isEmailScanRunning(),
    loadRecent(singlesId),
    loadGmailConfirm(singlesId)
  ]);
  return {
    configured: isEmailScanConfigured(cfg),
    poll_minutes: cfg.pollMinutes,
    llm_model: cfg.ollamaModel,
    forwarding_address: inbox ? forwardingAddressFor(inbox.inbox_token, cfg) : null,
    storage_backend: inbox?.storage_backend || null,
    gmail_filter_has_words: GMAIL_FILTER_HAS_WORDS,
    running,
    gmail_confirm: gmailConfirm,
    recent
  };
}

/** POST /api/emailScan/inbox — create (first click) or return the member's forwarding address + status. */
export async function postEmailScanInbox(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const inbox = await ensureInbox(singlesId, readBillStorageBackend(req));
    return res.json(await statusPayload(singlesId, inbox));
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /api/emailScan/status — poll while a scan runs. */
export async function getEmailScanStatus(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { rows } = await pool.query(
      `SELECT inbox_token, storage_backend, enabled
         FROM outdateddbsnapshotoct2024.email_scan_inbox WHERE singles_id = $1`,
      [singlesId]
    );
    return res.json(await statusPayload(singlesId, rows[0] || null));
  } catch (err) {
    return sendError(res, err);
  }
}

/** POST /api/emailScan/run — start a mailbox pass in the background (returns immediately). */
export async function postEmailScanRun(req, res) {
  try {
    requireSinglesId(req);
    if (!isEmailScanConfigured()) {
      return res.status(503).json({
        error: 'Auto Scan mailbox is not configured on the server yet (EMAIL_SCAN_IMAP_USER / EMAIL_SCAN_IMAP_PASS).'
      });
    }
    const alreadyRunning = await isEmailScanRunning();
    if (!alreadyRunning) void runEmailScanOnce();
    return res.json({ started: !alreadyRunning, running: true });
  } catch (err) {
    return sendError(res, err);
  }
}
