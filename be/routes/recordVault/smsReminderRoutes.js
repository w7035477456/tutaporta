/**
 * SMS reminder popup API (Bill Schedule Monthly / Yearly rows and ToDo tasks).
 *
 * GET    /api/smsReminder/defaults      → { phone }   last phone used, else the member's phone
 * GET    /api/smsReminder/:id           → { sms_reminder_id, phone, days_before, daily }
 * POST   /api/smsReminder               → create / update, texts a confirmation right away
 *        body { sms_reminder_id?, kind, phone, days_before, daily?, label, due_date?, bill_id? }
 *        daily = true → text every morning from days_before through the due date.
 *        bill_id (monthly_bill_id / yearly_bill_id) links the saved row now, so the icon
 *        stays on even before the user presses SAVE.
 * DELETE /api/smsReminder/:id           → turn off (unlinks bill / todo rows)
 */
import pool from '../../db/connection.js';
import { isTwilioOptOutError, isTwilioSmsConfigured, sendTwilioSms } from '../../lib/twilioSms.js';
import { buildConfirmText } from '../../utils/smsReminder.js';

const S = 'outdateddbsnapshotoct2024';
const KINDS = new Set(['monthly', 'yearly', 'todo']);
const BILL_TABLE = { monthly: ['monthly_bill', 'monthly_bill_id'], yearly: ['yearly_bill', 'yearly_bill_id'] };
/** Confirmation texts cost money: cap per member per day. */
const MAX_CONFIRMS_PER_DAY = 20;
const confirmsByUser = new Map();

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, err) {
  const statusCode = Number(err?.statusCode) || 500;
  if (statusCode >= 500) console.error('[sms-reminder-route]', err?.message, err?.code);
  return res.status(statusCode).json({ error: err?.message || 'SMS reminder request failed' });
}

function requireSinglesId(req) {
  const n = Math.trunc(Number(req.auth?.singles_id));
  if (!Number.isFinite(n) || n < 1) throw httpError(401, 'Authentication required');
  return n;
}

function toId(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function takeConfirmSlot(singlesId) {
  const today = new Date().toDateString();
  const entry = confirmsByUser.get(singlesId);
  const count = entry?.day === today ? entry.count : 0;
  if (count >= MAX_CONFIRMS_PER_DAY) return false;
  confirmsByUser.set(singlesId, { day: today, count: count + 1 });
  return true;
}

/** Any US phone ('1(703)547-7456', '+1 703.547.7456', '7035477456') → '+17035477456', else null. */
function toUsE164(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

/** '+15551234567' → '(555) 123-4567' for the popup. */
function displayPhone(e164) {
  const d = String(e164 ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(e164 ?? '');
}

export async function getSmsReminderDefaults(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const { rows } = await pool.query(
      `SELECT phone FROM ${S}.sms_reminder WHERE singles_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [singlesId]
    );
    let phone = rows[0]?.phone;
    if (!phone) {
      const me = await pool.query(`SELECT phone FROM ${S}.singles WHERE singles_id = $1`, [singlesId]);
      phone = me.rows[0]?.phone || '';
    }
    return res.json({ phone: displayPhone(phone), days_before: 1, configured: isTwilioSmsConfigured() });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getSmsReminder(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const id = toId(req.params?.id);
    if (!id) throw httpError(400, 'Bad reminder id');
    const { rows } = await pool.query(
      `SELECT sms_reminder_id, kind, phone, days_before, daily,
              to_char(last_sent_due_date, 'YYYY-MM-DD') AS last_sent_due_date, last_error
         FROM ${S}.sms_reminder WHERE sms_reminder_id = $1 AND singles_id = $2`,
      [id, singlesId]
    );
    if (!rows[0]) throw httpError(404, 'Reminder not found');
    return res.json({ ...rows[0], sms_reminder_id: Number(rows[0].sms_reminder_id), phone: displayPhone(rows[0].phone) });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function postSmsReminder(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const body = req.body || {};
    const kind = String(body.kind || '').trim();
    if (!KINDS.has(kind)) throw httpError(400, 'kind must be monthly, yearly or todo');
    const phone = toUsE164(body.phone);
    if (!phone) throw httpError(400, 'Enter a 10-digit US phone number');
    const daysBefore = Math.trunc(Number(body.days_before ?? 1));
    if (!Number.isFinite(daysBefore) || daysBefore < 0 || daysBefore > 30) {
      throw httpError(400, 'Days ahead must be 0 to 30');
    }
    // "Daily" with 0 days ahead is just "On the due date".
    const daily = body.daily === true && daysBefore > 0;
    const existingId = toId(body.sms_reminder_id);
    const billId = toId(body.bill_id);

    const client = await pool.connect();
    let reminderId;
    let phoneChanged = true;
    try {
      await client.query('BEGIN');
      if (existingId) {
        const { rows: prev } = await client.query(
          `SELECT phone, days_before, daily FROM ${S}.sms_reminder WHERE sms_reminder_id = $1 AND singles_id = $2 FOR UPDATE`,
          [existingId, singlesId]
        );
        if (!prev[0]) throw httpError(404, 'Reminder not found');
        // Confirm again when the number or the schedule changed.
        phoneChanged =
          prev[0].phone !== phone || Number(prev[0].days_before) !== daysBefore || Boolean(prev[0].daily) !== daily;
        // New phone or new lead time: allow the next due date to be texted again.
        await client.query(
          `UPDATE ${S}.sms_reminder
              SET phone = $3, days_before = $4, kind = $5, daily = $6, last_error = NULL,
                  last_sent_due_date = CASE WHEN phone = $3 AND days_before = $4 AND daily = $6
                                            THEN last_sent_due_date ELSE NULL END,
                  updated_at = now()
            WHERE sms_reminder_id = $1 AND singles_id = $2`,
          [existingId, singlesId, phone, daysBefore, kind, daily]
        );
        reminderId = existingId;
      } else {
        const { rows: created } = await client.query(
          `INSERT INTO ${S}.sms_reminder (singles_id, kind, phone, days_before, daily)
           VALUES ($1, $2, $3, $4, $5) RETURNING sms_reminder_id`,
          [singlesId, kind, phone, daysBefore, daily]
        );
        reminderId = Number(created[0].sms_reminder_id);
      }
      if (billId && BILL_TABLE[kind]) {
        const [table, pk] = BILL_TABLE[kind];
        await client.query(
          `UPDATE ${S}.${table} SET sms_reminder_id = $1 WHERE ${pk} = $2 AND singles_id = $3`,
          [reminderId, billId, singlesId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    // Confirmation text: on create, or when the phone number changed.
    let confirmationSent = false;
    let warning = '';
    if (phoneChanged) {
      if (!takeConfirmSlot(singlesId)) {
        warning = 'Reminder saved. Confirmation text skipped (daily limit reached).';
      } else {
        try {
          await sendTwilioSms(
            phone,
            buildConfirmText({ label: body.label, dueYmd: body.due_date, daysBefore, daily })
          );
          confirmationSent = true;
        } catch (err) {
          warning = isTwilioOptOutError(err)
            ? 'This number replied STOP. Text START to our number to receive texts again.'
            : `Reminder saved, but the confirmation text failed: ${err?.message || err}`;
          console.error('[sms-reminder-route] confirmation failed', { code: err?.code, message: err?.message });
        }
      }
    }
    return res.json({ ok: true, sms_reminder_id: reminderId, confirmation_sent: confirmationSent, warning });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function deleteSmsReminder(req, res) {
  try {
    const singlesId = requireSinglesId(req);
    const id = toId(req.params?.id);
    if (!id) throw httpError(400, 'Bad reminder id');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of ['monthly_bill', 'yearly_bill', 'todo_item']) {
        await client.query(
          `UPDATE ${S}.${table} SET sms_reminder_id = NULL WHERE sms_reminder_id = $1 AND singles_id = $2`,
          [id, singlesId]
        );
      }
      await client.query(`DELETE FROM ${S}.sms_reminder WHERE sms_reminder_id = $1 AND singles_id = $2`, [id, singlesId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, err);
  }
}
