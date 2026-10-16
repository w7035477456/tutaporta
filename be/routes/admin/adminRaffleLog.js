/**
 * Admin Tools → Raffles tab: filter the append-only raffle_log.log (same file as `rafflelog`).
 *   GET  /api/admin/raffle-log/events   drop-down (event_show_combo = true)
 *   POST /api/admin/raffle-log/lookup   { eventId?, action?: string[], result?: string[], singlesId?, from?, to?, when?: ['past'|'today'|'future'] }
 * Filters are ANDed; empty filters are ignored. The log lives on each server's disk.
 */
import fs from 'fs';
import pool from '../../db/connection.js';
import { RAFFLE_HARD_COPY_LOG_PATH } from '../../utils/hardCopyAuthLog.js';

const S = 'outdateddbsnapshotoct2024';
const ACTIONS = new Set(['generate', 'draw', 'code', 'scan', 'payout']);
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
