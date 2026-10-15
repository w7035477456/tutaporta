import crypto from 'node:crypto';
import pool from '../../db/connection.js';
import { RAFFLE_EVENTS, findRaffleEvent } from '../../utils/raffleEvents.js';

/** No 0/O/1/I/L — easy to read aloud and type from a screenshot. */
const VERIFY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VERIFY_CODE_LENGTH = 8;
const MAX_INSERT_ATTEMPTS = 8;

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

function ticketPayload(row) {
  const event = findRaffleEvent(row.event_key);
  const verifyCode = formatVerifyCode(row.verify_code);
  return {
    eventKey: row.event_key,
    eventLabel: event?.label || row.event_key,
    raffleNumber: Number(row.raffle_number),
    verifyCode,
    verifyPath: `/raffle/verify/${verifyCode}`,
    createdAt: row.created_at
  };
}

function authSinglesId(req) {
  const id = Number(req.auth?.singles_id);
  return Number.isFinite(id) && id >= 1 ? id : null;
}

async function loadTicket(singlesId, eventKey) {
  const { rows } = await pool.query(
    `SELECT event_key, raffle_number, verify_code, created_at
       FROM outdateddbsnapshotoct2024.raffle_tickets
      WHERE singles_id = $1 AND event_key = $2
      LIMIT 1`,
    [singlesId, eventKey]
  );
  return rows[0] || null;
}

/** GET /api/raffle — events for the drop-down + this member's existing tickets. */
export async function getRaffleState(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { rows } = await pool.query(
      `SELECT event_key, raffle_number, verify_code, created_at
         FROM outdateddbsnapshotoct2024.raffle_tickets
        WHERE singles_id = $1
        ORDER BY created_at`,
      [singlesId]
    );
    return res.json({
      events: RAFFLE_EVENTS.map(({ key, label, url }) => ({ key, label, url })),
      tickets: rows.map(ticketPayload)
    });
  } catch (err) {
    console.error('[raffle] load failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffles. Please try again.' });
  }
}

/**
 * POST /api/raffle/tickets { eventKey } — issue this member's ticket for the event
 * (or return the one they already have: one raffle per account per event).
 */
export async function postRaffleTicket(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) {
    return res.status(403).json({ error: 'Please log in or sign up with your own account to get a raffle.' });
  }
  const event = findRaffleEvent(req.body?.eventKey);
  if (!event) return res.status(400).json({ error: 'Please choose an event.' });

  try {
    const existing = await loadTicket(singlesId, event.key);
    if (existing) return res.json({ ticket: ticketPayload(existing), alreadyHad: true });

    for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
      // Random free number for this event; a concurrent claim on the same number / code
      // hits a UNIQUE constraint → DO NOTHING → retry.
      const { rows } = await pool.query(
        `INSERT INTO outdateddbsnapshotoct2024.raffle_tickets (event_key, singles_id, raffle_number, verify_code)
         SELECT $1, $2, n, $3
           FROM generate_series(1, 1000) AS n
          WHERE NOT EXISTS (
            SELECT 1 FROM outdateddbsnapshotoct2024.raffle_tickets t
             WHERE t.event_key = $1 AND t.raffle_number = n
          )
          ORDER BY random()
          LIMIT 1
         ON CONFLICT DO NOTHING
         RETURNING event_key, raffle_number, verify_code, created_at`,
        [event.key, singlesId, newVerifyCode()]
      );
      if (rows[0]) return res.status(201).json({ ticket: ticketPayload(rows[0]), alreadyHad: false });

      const raced = await loadTicket(singlesId, event.key);
      if (raced) return res.json({ ticket: ticketPayload(raced), alreadyHad: true });

      const { rows: countRows } = await pool.query(
        `SELECT count(*)::int AS n FROM outdateddbsnapshotoct2024.raffle_tickets WHERE event_key = $1`,
        [event.key]
      );
      if ((countRows[0]?.n || 0) >= 1000) {
        return res.status(409).json({ error: 'All 1,000 raffle numbers for this event are taken.' });
      }
    }
    return res.status(503).json({ error: 'Raffle is busy right now. Please try again.' });
  } catch (err) {
    console.error('[raffle] issue failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not create your raffle. Please try again.' });
  }
}
