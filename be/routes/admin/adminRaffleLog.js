/**
 * Admin Tools → Raffles tab: filter the append-only raffle_log.log (same file as `rafflelog`).
 *   GET  /api/admin/raffle-log/events   drop-down (event_show_combo = true)
 *   POST /api/admin/raffle-log/lookup   { eventId?, action?: string[], result?: string[], singlesId?, from?, to?, when?: ['past'|'today'|'future'] }
 * Filters are ANDed; empty filters are ignored. The log lives on each server's disk.
 *   GET  /api/admin/raffle-winners?eventId=   verified winners with raffle_status (WINVERIFIED / CLAIMED / PAID)
 *   POST /api/admin/raffle-winners/paid       { raffleUserId } — CLAIMED → PAID (raffle_prize_paid = true)
 */
import fs from 'fs';
import pool from '../../db/connection.js';
import { RAFFLE_HARD_COPY_LOG_PATH, appendRaffleHostActionHardCopy } from '../../utils/hardCopyAuthLog.js';

const S = 'outdateddbsnapshotoct2024';
const ACTIONS = new Set(['generate', 'draw', 'code', 'scan', 'payout', 'paid']);
const WHEN_VALUES = new Set(['past', 'today', 'future']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLine(line) {
  const fields = {};
  for (const part of line.split('\t')) {
    const n = part.indexOf('=');
    if (n > 0) {
      const value = part.slice(n + 1);
      fields[part.slice(0, n)] = value === '-' ? '' : value;
    }
  }
  return fields;
}

function toRow(f) {
  return {
    when: f.datetime || f.raffle_generate_datetime || '',
    action: f.action || 'generate',
    number: f.raffle_number || f.winning_raffle_number || '',
    code: f.verification_code || f.raffle_generate_id || '',
    result: f.result || (f.payout_method ? `${f.payout_method}: ${f.payout_info || ''}` : ''),
    singlesId: f.singles_id || '',
    name: f.singles_fullname || '',
    event: f.event_title || '',
    host: f.host_full_name || '',
    eventId: f.event_id ? Number(f.event_id) : null,
    imageFile: f.image_file || ''
  };
}

function readRaffleLogRows() {
  let text = '';
  try {
    text = fs.readFileSync(RAFFLE_HARD_COPY_LOG_PATH, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => toRow(parseLine(line)));
}

/** Every event with its timing relative to today in the event's own time zone. */
async function loadEventTiming() {
  const { rows } = await pool.query(
    `SELECT event_id, event_title, event_show_combo,
            CASE
              WHEN event_night_datetime IS NULL THEN NULL
              WHEN (event_night_datetime AT TIME ZONE event_time_zone)::date < (now() AT TIME ZONE event_time_zone)::date THEN 'past'
              WHEN (event_night_datetime AT TIME ZONE event_time_zone)::date > (now() AT TIME ZONE event_time_zone)::date THEN 'future'
              ELSE 'today'
            END AS timing
       FROM ${S}.raffle_event
      ORDER BY event_night_datetime NULLS LAST, event_id`
  );
  return rows;
}

/** GET /api/admin/raffle-log/events */
export async function getAdminRaffleLogEvents(_req, res) {
  try {
    const events = await loadEventTiming();
    return res.json({
      events: events
        .filter((e) => e.event_show_combo)
        .map((e) => ({ eventId: Number(e.event_id), title: e.event_title || `Event ${e.event_id}` }))
    });
  } catch (err) {
    console.error('[adminRaffleLog] events:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffle events.' });
  }
}

/** POST /api/admin/raffle-log/lookup */
export async function postAdminRaffleLogLookup(req, res) {
  try {
    const body = req.body || {};
    const eventId = Number.isInteger(Number(body.eventId)) && Number(body.eventId) > 0 ? Number(body.eventId) : null;
    const actions = new Set(
      (Array.isArray(body.action) ? body.action : [body.action])
        .map((a) => String(a || '').toLowerCase())
        .filter((a) => ACTIONS.has(a))
    );
    const results = new Set(
      (Array.isArray(body.result) ? body.result : [body.result])
        .map((r) => String(r || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const singlesId = String(body.singlesId || '').trim();
    const from = DATE_RE.test(String(body.from || '')) ? body.from : '';
    const to = DATE_RE.test(String(body.to || '')) ? body.to : '';
    const when = new Set((Array.isArray(body.when) ? body.when : []).filter((w) => WHEN_VALUES.has(w)));
    if (when.size === WHEN_VALUES.size) when.clear();

    const events = await loadEventTiming();
    const byId = new Map(events.map((e) => [Number(e.event_id), e]));
    const byTitle = new Map(events.map((e) => [String(e.event_title || '').trim().toLowerCase(), e]));
    const eventOf = (row) =>
      (row.eventId != null && byId.get(row.eventId)) || byTitle.get(row.event.trim().toLowerCase()) || null;

    const rows = readRaffleLogRows().filter((row) => {
      const day = row.when.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (actions.size && !actions.has(row.action)) return false;
      if (results.size && !results.has(row.result.toLowerCase())) return false;
      if (singlesId && row.singlesId !== singlesId) return false;
      if (eventId || when.size) {
        const ev = eventOf(row);
        if (eventId && Number(ev?.event_id) !== eventId) return false;
        if (when.size && !when.has(ev?.timing)) return false;
      }
      return true;
    });
    return res.json({ rows, total: rows.length });
  } catch (err) {
    console.error('[adminRaffleLog] lookup:', err?.message || err);
    return res.status(500).json({ error: 'Could not read the raffle log.' });
  }
}

const WINNER_SELECT = `
  SELECT u.raffle_user_id, u.singles_id, u.event_id, u.raffle_number, u.raffle_status,
         u.raffle_claimed_datetime, u.paypal_info, u.venmo_info, u.raffle_prize_paid_datetime,
         e.event_title, h.host_full_name,
         NULLIF(TRIM(CONCAT_WS(' ', s.mailing_firstname, s.mailing_lastname)), '') AS fullname, s.email
    FROM ${S}.raffle_user u
    JOIN ${S}.raffle_event e ON e.event_id = u.event_id
    JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
    LEFT JOIN ${S}.singles s ON s.singles_id = u.singles_id`;

function winnerRow(r) {
  return {
    raffleUserId: Number(r.raffle_user_id),
    singlesId: Number(r.singles_id),
    name: r.fullname || '',
    email: r.email || '',
    eventId: Number(r.event_id),
    event: r.event_title || '',
    host: r.host_full_name || '',
    number: r.raffle_number == null ? '' : Number(r.raffle_number),
    status: r.raffle_status || '',
    payout: r.paypal_info ? `PayPal: ${r.paypal_info}` : r.venmo_info ? `Venmo: ${r.venmo_info}` : '',
    verifiedAt: r.raffle_claimed_datetime || null,
    paidAt: r.raffle_prize_paid_datetime || null
  };
}

/** GET /api/admin/raffle-winners?eventId= */
export async function getAdminRaffleWinners(req, res) {
  try {
    const eventId = Number(req.query?.eventId);
    const byEvent = Number.isInteger(eventId) && eventId > 0;
    const { rows } = await pool.query(
      `${WINNER_SELECT}
        WHERE u.raffle_status IS NOT NULL ${byEvent ? 'AND u.event_id = $1' : ''}
        ORDER BY CASE u.raffle_status WHEN 'CLAIMED' THEN 0 WHEN 'WINVERIFIED' THEN 1 ELSE 2 END,
                 u.raffle_claimed_datetime DESC NULLS LAST, u.raffle_user_id DESC`,
      byEvent ? [eventId] : []
    );
    return res.json({ winners: rows.map(winnerRow) });
  } catch (err) {
    console.error('[adminRaffleLog] winners:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffle winners.' });
  }
}

/** POST /api/admin/raffle-winners/paid { raffleUserId } — only a CLAIMED winner (payout info on file) can be paid. */
export async function postAdminRaffleWinnerPaid(req, res) {
  const raffleUserId = Number(req.body?.raffleUserId);
  if (!Number.isInteger(raffleUserId) || raffleUserId < 1) return res.status(400).json({ error: 'Missing raffle winner.' });
  try {
    const { rows } = await pool.query(
      `WITH paid AS (
         UPDATE ${S}.raffle_user
            SET raffle_status = 'PAID', raffle_prize_paid = true, raffle_prize_paid_datetime = now()
          WHERE raffle_user_id = $1 AND raffle_status = 'CLAIMED'
          RETURNING *
       )
       ${WINNER_SELECT.replace(`${S}.raffle_user u`, 'paid u')}`,
      [raffleUserId]
    );
    const saved = rows[0];
    if (!saved) return res.status(409).json({ error: 'Only a CLAIMED winner (PayPal / Venmo submitted) can be marked paid.' });
    const winner = winnerRow(saved);
    appendRaffleHostActionHardCopy('paid', {
      event_id: winner.eventId,
      event_title: winner.event,
      host_full_name: winner.host,
      raffle_number: winner.number,
      raffle_user_id: winner.raffleUserId,
      singles_id: winner.singlesId,
      singles_fullname: winner.name,
      result: 'PAID',
      payout_info: winner.payout,
      admin_singles_id: req.auth?.singles_id ?? ''
    });
    return res.json({ ok: true, winner });
  } catch (err) {
    console.error('[adminRaffleLog] mark paid:', err?.message || err);
    return res.status(500).json({ error: 'Could not mark the prize paid.' });
  }
}
