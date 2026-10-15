import crypto from 'node:crypto';
import pool from '../../db/connection.js';
import { appendRaffleHardCopy } from '../../utils/hardCopyAuthLog.js';

const S = 'outdateddbsnapshotoct2024';

/** No 0/O/1/I/L — easy to read aloud and type from a screenshot. */
const VERIFY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VERIFY_CODE_LENGTH = 8;
const MAX_GENERATE_ATTEMPTS = 10;

export const RAFFLE_ALREADY_GENERATED_MESSAGE =
  'You already generate a raffle for this event. Only 1 raffle per email login.';

function newVerifyCode() {
  let code = '';
  for (let i = 0; i < VERIFY_CODE_LENGTH; i += 1) {
    code += VERIFY_CODE_ALPHABET[crypto.randomInt(VERIFY_CODE_ALPHABET.length)];
  }
  return code;
}

/** K7Q4MZ9X → K7Q4-MZ9X */
function formatVerifyCode(code) {
  const c = String(code || '');
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

function eventLabel(row) {
  const host = String(row.host_full_name || '').trim();
  return host ? `${row.event_title} (hosted by ${host})` : row.event_title;
}

function formatEasternTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function ticketPayload(row) {
  const verifyCode = formatVerifyCode(row.raffle_generated_id);
  return {
    eventId: Number(row.event_id),
    eventLabel: eventLabel(row),
    raffleNumber: Number(row.raffle_number),
    verifyCode,
    verifyPath: `/raffle/verify/${verifyCode}`,
    createdAt: row.raffle_generate_datetime
  };
}

function authSinglesId(req) {
  const id = Number(req.auth?.singles_id);
  return Number.isFinite(id) && id >= 1 ? id : null;
}

function parseEventId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/** Drop-down event (event_show_combo = true only) + host + whether the raffle window is open now. */
async function loadComboEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT e.event_id, e.event_title, e.event_url, e.event_night_datetime, e.event_build_n_address,
            e.host_event_raffle_start, e.host_event_raffle_end, e.raffle_host_id,
            h.host_full_name, h.host_url,
            COALESCE(now() BETWEEN e.host_event_raffle_start AND e.host_event_raffle_end, false) AS raffle_open
       FROM ${S}.raffle_event e
       JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
      WHERE e.event_id = $1 AND e.event_show_combo = true
      LIMIT 1`,
    [eventId]
  );
  return rows[0] || null;
}

/** Link member ↔ host ↔ event (raffle_number stays NULL until Generate My Raffle). */
async function ensureRaffleUserRow(singlesId, event) {
  await pool.query(
    `INSERT INTO ${S}.raffle_user (singles_id, raffle_host_id, event_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (singles_id, event_id) DO NOTHING`,
    [singlesId, event.raffle_host_id, event.event_id]
  );
  const { rows } = await pool.query(
    `SELECT raffle_user_id, event_id, raffle_number, raffle_generated_id, raffle_generate_datetime
       FROM ${S}.raffle_user
      WHERE singles_id = $1 AND event_id = $2
      LIMIT 1`,
    [singlesId, event.event_id]
  );
  return rows[0] || null;
}

async function loadSinglesForLog(singlesId) {
  const { rows } = await pool.query(`SELECT to_jsonb(s) AS j FROM ${S}.singles s WHERE s.singles_id = $1 LIMIT 1`, [
    singlesId
  ]);
  const j = rows[0]?.j || {};
  const pick = (...keys) =>
    keys
      .map((k) => String(j[k] ?? '').trim())
      .filter(Boolean)
      .join(' ');
  const fullname = pick('firstname', 'lastname') || pick('mailing_firstname', 'mailing_lastname') || pick('alias');
  return { email: String(j.email ?? '').trim(), fullname };
}

/** GET /api/raffle — drop-down events (event_show_combo = true) + this member's generated raffles. */
export async function getRaffleState(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { rows: eventRows } = await pool.query(
      `SELECT e.event_id, e.event_title, e.event_url, e.event_night_datetime, e.event_build_n_address,
              e.host_event_raffle_start, e.host_event_raffle_end, h.host_full_name
         FROM ${S}.raffle_event e
         JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
        WHERE e.event_show_combo = true
        ORDER BY e.event_night_datetime NULLS LAST, e.event_id`
    );
    const { rows: ticketRows } = await pool.query(
      `SELECT u.event_id, u.raffle_number, u.raffle_generated_id, u.raffle_generate_datetime,
              e.event_title, h.host_full_name
         FROM ${S}.raffle_user u
         JOIN ${S}.raffle_event e ON e.event_id = u.event_id
         JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
        WHERE u.singles_id = $1 AND u.raffle_number IS NOT NULL
        ORDER BY u.raffle_generate_datetime`,
      [singlesId]
    );
    return res.json({
      events: eventRows.map((row) => ({
        eventId: Number(row.event_id),
        label: eventLabel(row),
        url: row.event_url || '',
        nightDatetime: row.event_night_datetime,
        address: row.event_build_n_address || '',
        raffleStart: row.host_event_raffle_start,
        raffleEnd: row.host_event_raffle_end
      })),
      tickets: ticketRows.map(ticketPayload),
      alreadyGeneratedMessage: RAFFLE_ALREADY_GENERATED_MESSAGE
    });
  } catch (err) {
    console.error('[raffle] load failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffles. Please try again.' });
  }
}

/** POST /api/raffle/select { eventId } — member picked an event: create the linked raffle_user row. */
export async function postRaffleSelect(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) return res.json({ ok: true });
  const eventId = parseEventId(req.body?.eventId);
  if (!eventId) return res.status(400).json({ error: 'Please choose an event.' });
  try {
    const event = await loadComboEvent(eventId);
    if (!event) return res.status(400).json({ error: 'Please choose an event.' });
    await ensureRaffleUserRow(singlesId, event);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[raffle] select failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not select the event. Please try again.' });
  }
}

/**
 * POST /api/raffle/tickets { eventId } — Generate My Raffle.
 *   a) now must be within host_event_raffle_start … host_event_raffle_end
 *   b) raffle_number already set → return it with RAFFLE_ALREADY_GENERATED_MESSAGE
 *   otherwise draw a number unique within the event, save it + raffle_generate_datetime, append raffle_log.log.
 */
export async function postRaffleTicket(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) {
    return res.status(403).json({ error: 'Please log in or sign up with your own account to get a raffle.' });
  }
  const eventId = parseEventId(req.body?.eventId);
  if (!eventId) return res.status(400).json({ error: 'Please choose an event.' });

  try {
    const event = await loadComboEvent(eventId);
    if (!event) return res.status(400).json({ error: 'Please choose an event.' });

    if (!event.raffle_open) {
      const start = formatEasternTime(event.host_event_raffle_start);
      const end = formatEasternTime(event.host_event_raffle_end);
      return res.status(403).json({
        error: start && end ? `Raffle for this event is open only from ${start} to ${end} (ET).` : 'Raffle for this event is not open.'
      });
    }

    let row = await ensureRaffleUserRow(singlesId, event);
    if (!row) return res.status(500).json({ error: 'Could not create your raffle. Please try again.' });

    const withEvent = (r) => ({ ...r, event_title: event.event_title, host_full_name: event.host_full_name });
    if (row.raffle_number != null) {
      return res.json({ ticket: ticketPayload(withEvent(row)), alreadyHad: true, message: RAFFLE_ALREADY_GENERATED_MESSAGE });
    }

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
      try {
        // Random number not yet used in this event; a concurrent claim of the same number / code
        // raises a UNIQUE violation (23505) → draw again.
        const { rows } = await pool.query(
          `UPDATE ${S}.raffle_user u
              SET raffle_number = pick.n,
                  raffle_generated_id = $2,
                  raffle_generate_datetime = now()
             FROM (
               SELECT n FROM generate_series(1, 1000) AS n
                WHERE NOT EXISTS (
                  SELECT 1 FROM ${S}.raffle_user t WHERE t.event_id = $3 AND t.raffle_number = n
                )
                ORDER BY random()
                LIMIT 1
             ) AS pick
            WHERE u.raffle_user_id = $1 AND u.raffle_number IS NULL
            RETURNING u.raffle_user_id, u.event_id, u.raffle_number, u.raffle_generated_id, u.raffle_generate_datetime`,
          [row.raffle_user_id, newVerifyCode(), event.event_id]
        );
        if (rows[0]) {
          const issued = rows[0];
          const who = await loadSinglesForLog(singlesId).catch(() => ({ email: '', fullname: '' }));
          appendRaffleHardCopy({
            raffleNumber: issued.raffle_number,
            raffleGenerateId: formatVerifyCode(issued.raffle_generated_id),
            raffleGenerateDatetime: issued.raffle_generate_datetime,
            singlesId,
            singlesEmail: who.email,
            singlesFullname: who.fullname,
            eventTitle: event.event_title,
            hostFullName: event.host_full_name,
            hostUrl: event.host_url,
            hostEventStart: event.host_event_raffle_start,
            hostEventEnd: event.host_event_raffle_end
          });
          return res.status(201).json({ ticket: ticketPayload(withEvent(issued)), alreadyHad: false });
        }
      } catch (err) {
        if (err?.code !== '23505') throw err;
        continue;
      }

      row = await ensureRaffleUserRow(singlesId, event);
      if (row?.raffle_number != null) {
        return res.json({ ticket: ticketPayload(withEvent(row)), alreadyHad: true, message: RAFFLE_ALREADY_GENERATED_MESSAGE });
      }
      return res.status(409).json({ error: 'All 1,000 raffle numbers for this event are taken.' });
    }
    return res.status(503).json({ error: 'Raffle is busy right now. Please try again.' });
  } catch (err) {
    console.error('[raffle] generate failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not create your raffle. Please try again.' });
  }
}
