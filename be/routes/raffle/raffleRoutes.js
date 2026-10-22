import crypto from 'node:crypto';
import pool from '../../db/connection.js';
import { appendRaffleHardCopy, appendRaffleHostActionHardCopy } from '../../utils/hardCopyAuthLog.js';
import { DEFAULT_REFER_BY_CODE } from '../../utils/referByCode.js';
import { sendRafflePayoutEmailFireAndForget } from '../../lib/rafflePayoutEmail.js';

const S = 'outdateddbsnapshotoct2024';

/** SQL: the event's current winning number = newest raffle_draw row (NULL before the first draw). */
export function latestDrawNumberSql(eventIdExpr) {
  return `(SELECT d.raffle_number FROM ${S}.raffle_draw d WHERE d.event_id = ${eventIdExpr}
            ORDER BY d.raffle_draw_datetime DESC, d.raffle_draw_id DESC LIMIT 1)`;
}

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
export function formatVerifyCode(code) {
  const c = String(code || '');
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

function eventLabel(row) {
  const host = String(row.host_full_name || '').trim();
  return host ? `${row.event_title} (hosted by ${host})` : row.event_title;
}

const DEFAULT_EVENT_TIME_ZONE = 'America/New_York';

function formatEventTime(value, timeZone) {
  if (!value) return '';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  try {
    return new Date(value).toLocaleString('en-US', { ...opts, timeZone: timeZone || DEFAULT_EVENT_TIME_ZONE });
  } catch {
    return new Date(value).toLocaleString('en-US', { ...opts, timeZone: DEFAULT_EVENT_TIME_ZONE });
  }
}

function timeZoneAbbrev(value, timeZone) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || DEFAULT_EVENT_TIME_ZONE, timeZoneName: 'short' })
      .formatToParts(new Date(value))
      .find((p) => p.type === 'timeZoneName');
    return part?.value || '';
  } catch {
    return '';
  }
}

function ticketPayload(row) {
  const verifyCode = formatVerifyCode(row.raffle_generated_id);
  return {
    eventId: Number(row.event_id),
    eventLabel: eventLabel(row),
    eventAddress: String(row.event_build_n_address || '').trim(),
    raffleNumber: Number(row.raffle_number),
    verifyCode,
    verifyPath: `/raffle/verify/${verifyCode}`,
    createdAt: row.raffle_generate_datetime,
    claimedAt: row.raffle_claimed_datetime || null,
    bonus: row.raffle_bonus === true,
    won: row.is_drawn === true || Boolean(row.raffle_status),
    paypalInfo: row.paypal_info || '',
    venmoInfo: row.venmo_info || '',
    prizePaid: row.raffle_prize_paid === true,
    prizePaidAt: row.raffle_prize_paid_datetime || null,
    status: row.raffle_status || ''
  };
}

export const RAFFLE_PRIZE_DOLLARS = 200;

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
            e.host_event_raffle_start, e.host_event_raffle_end, e.raffle_host_id, e.event_time_zone,
            h.host_full_name, h.host_url,
            COALESCE(now() BETWEEN e.host_event_raffle_start AND e.host_event_raffle_end, false) AS raffle_open,
            COALESCE(now() >= e.event_night_datetime, false) AS night_passed
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
     ON CONFLICT (singles_id, event_id) WHERE NOT raffle_bonus DO NOTHING`,
    [singlesId, event.raffle_host_id, event.event_id]
  );
  const { rows } = await pool.query(
    `SELECT raffle_user_id, event_id, raffle_number, raffle_generated_id, raffle_generate_datetime
       FROM ${S}.raffle_user
      WHERE singles_id = $1 AND event_id = $2 AND NOT raffle_bonus
      LIMIT 1`,
    [singlesId, event.event_id]
  );
  return rows[0] || null;
}

/** Permanent Friend Refer Code R#### (singles.raffle_refer_code); assigned once, reused across every event. */
async function ensureRaffleReferCode(singlesId) {
  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
    try {
      const { rows } = await pool.query(
        `WITH assigned AS (
           UPDATE ${S}.singles s
              SET raffle_refer_code = (
                SELECT 'R' || n FROM generate_series(1000, 9999) AS n
                 WHERE NOT EXISTS (SELECT 1 FROM ${S}.singles t WHERE t.raffle_refer_code = 'R' || n)
                 ORDER BY random()
                 LIMIT 1
              )
            WHERE s.singles_id = $1 AND s.raffle_refer_code IS NULL
            RETURNING s.raffle_refer_code
         )
         SELECT raffle_refer_code FROM assigned
         UNION ALL
         SELECT raffle_refer_code FROM ${S}.singles WHERE singles_id = $1 AND raffle_refer_code IS NOT NULL
         LIMIT 1`,
        [singlesId]
      );
      return String(rows[0]?.raffle_refer_code || '');
    } catch (err) {
      if (err?.code !== '23505') throw err;
    }
  }
  return '';
}

/** Bonus raffle tickets per referral credit (~/.ssh/be/.env RAFFLE_PER_REFER, default 2). */
export function rafflePerRefer() {
  const n = Number.parseInt(process.env.RAFFLE_PER_REFER, 10);
  return Number.isInteger(n) && n >= 1 ? n : 2;
}

/**
 * Bonus tickets already paid for by spent credits but not generated yet (a credit covers `per` tickets; generating
 * fewer leaves the rest). Rows from one Generate click share raffle_generate_datetime (one transaction's now()).
 */
async function loadBonusLeftover(db, singlesId, per) {
  const { rows } = await db.query(
    `SELECT COALESCE(sum(b.credits), 0)::int AS credits, COALESCE(sum(b.n), 0)::int AS tickets
       FROM (SELECT max(raffle_bonus_credits_used) AS credits, count(*) AS n
               FROM ${S}.raffle_user
              WHERE singles_id = $1 AND raffle_bonus
              GROUP BY event_id, raffle_generate_datetime) b`,
    [singlesId]
  );
  return Math.max(0, (Number(rows[0]?.credits) || 0) * per - (Number(rows[0]?.tickets) || 0));
}

/** Unspent credits, bonus tickets still available to generate (any event), friends registered with my code. */
async function loadReferStats(singlesId) {
  const per = rafflePerRefer();
  const { rows } = await pool.query(
    `SELECT s.raffle_refer_credit,
            (SELECT count(*)::int FROM ${S}.singles f
              WHERE s.raffle_refer_code IS NOT NULL AND f.raffle_refer_by_code = s.raffle_refer_code
                AND f.singles_id <> s.singles_id) AS friends
       FROM ${S}.singles s WHERE s.singles_id = $1`,
    [singlesId]
  );
  const credit = Number(rows[0]?.raffle_refer_credit) || 0;
  const leftover = await loadBonusLeftover(pool, singlesId, per);
  return { credit, remaining: credit * per + leftover, friends: Number(rows[0]?.friends) || 0 };
}

export async function loadSinglesForLog(singlesId) {
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

/**
 * GET /api/raffle — drop-down events (event_show_combo = true, plus forever every event this member won /
 * claimed or holds a raffle for — past ones feed the "Past Event" list) + this member's generated raffles.
 */
export async function getRaffleState(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const { rows: eventRows } = await pool.query(
      `SELECT e.event_id, e.event_title, e.event_url, e.event_night_datetime, e.event_build_n_address,
              e.host_event_raffle_start, e.host_event_raffle_end, e.event_time_zone, e.event_show_combo,
              COALESCE(now() > e.event_night_datetime, false) AS night_passed, h.host_full_name
         FROM ${S}.raffle_event e
         JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
        WHERE e.event_show_combo = true
           OR EXISTS (SELECT 1 FROM ${S}.raffle_user c
                       WHERE c.event_id = e.event_id AND c.singles_id = $1
                         AND (c.raffle_status IS NOT NULL OR c.raffle_number IS NOT NULL))
        ORDER BY e.event_night_datetime NULLS LAST, e.event_id`,
      [singlesId]
    );
    const { rows: ticketRows } = await pool.query(
      `SELECT u.event_id, u.raffle_number, u.raffle_generated_id, u.raffle_generate_datetime,
              u.raffle_claimed_datetime, u.paypal_info, u.venmo_info,
              u.raffle_prize_paid, u.raffle_prize_paid_datetime, u.raffle_bonus, u.raffle_status,
              COALESCE(u.raffle_number = ${latestDrawNumberSql('u.event_id')}, false) AS is_drawn,
              e.event_title, e.event_build_n_address, h.host_full_name
         FROM ${S}.raffle_user u
         JOIN ${S}.raffle_event e ON e.event_id = u.event_id
         JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
        WHERE u.singles_id = $1 AND u.raffle_number IS NOT NULL
        ORDER BY u.raffle_bonus, u.raffle_generate_datetime, u.raffle_user_id`,
      [singlesId]
    );
    const refer = await loadReferStats(singlesId).catch((err) => {
      console.error('[raffle] refer stats failed:', err?.message || err);
      return { credit: 0, remaining: 0, friends: 0 };
    });
    const referCode =
      req.auth?.guest_demo_login === true
        ? ''
        : await ensureRaffleReferCode(singlesId).catch((err) => {
            console.error('[raffle] refer code failed:', err?.message || err);
            return '';
          });
    return res.json({
      referCode,
      referCredit: refer.credit,
      referRemaining: refer.remaining,
      referFriends: refer.friends,
      rafflePerRefer: rafflePerRefer(),
      events: eventRows.map((row) => ({
        eventId: Number(row.event_id),
        label: eventLabel(row),
        title: row.event_title || '',
        url: row.event_url || '',
        nightDatetime: row.event_night_datetime,
        nightPassed: row.night_passed === true,
        showCombo: row.event_show_combo === true,
        address: row.event_build_n_address || '',
        raffleStart: row.host_event_raffle_start,
        raffleEnd: row.host_event_raffle_end,
        timeZone: row.event_time_zone || DEFAULT_EVENT_TIME_ZONE
      })),
      tickets: ticketRows.map(ticketPayload),
      prizeDollars: RAFFLE_PRIZE_DOLLARS,
      alreadyGeneratedMessage: RAFFLE_ALREADY_GENERATED_MESSAGE
    });
  } catch (err) {
    console.error('[raffle] load failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffles. Please try again.' });
  }
}

/**
 * GET /api/raffle/pending-prize — host-verified win (raffle_status = WINVERIFIED), PayPal / Venmo not submitted yet.
 * The FE keeps sending this member back to /mall until the payout form is submitted.
 */
export async function getRafflePendingPrize(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) return res.json({ pending: false, eventId: null });
  try {
    const { rows } = await pool.query(
      `SELECT u.event_id
         FROM ${S}.raffle_user u
        WHERE u.singles_id = $1 AND u.raffle_status = 'WINVERIFIED'
        ORDER BY u.raffle_claimed_datetime DESC NULLS LAST, u.raffle_user_id DESC
        LIMIT 1`,
      [singlesId]
    );
    return res.json({ pending: rows.length > 0, eventId: rows[0] ? Number(rows[0].event_id) : null });
  } catch (err) {
    console.error('[raffle] pending prize check failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not check raffle prize.' });
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
      const tz = event.event_time_zone;
      const start = formatEventTime(event.host_event_raffle_start, tz);
      const end = formatEventTime(event.host_event_raffle_end, tz);
      const abbrev = timeZoneAbbrev(event.host_event_raffle_end, tz);
      return res.status(403).json({
        error:
          start && end
            ? `Raffle for this event is open only from ${start} to ${end}${abbrev ? ` (${abbrev})` : ''}.`
            : 'Raffle for this event is not open.'
      });
    }

    let row = await ensureRaffleUserRow(singlesId, event);
    if (!row) return res.status(500).json({ error: 'Could not create your raffle. Please try again.' });

    const withEvent = (r) => ({
      ...r,
      event_title: event.event_title,
      event_build_n_address: event.event_build_n_address,
      host_full_name: event.host_full_name
    });
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

/**
 * POST /api/raffle/bonus-tickets { eventId, count } — spend singles.raffle_refer_credit on extra tickets.
 *   Each credit = rafflePerRefer() tickets. Leftover tickets from a partly used credit are spent first; then
 *   credits used = ceil((count − leftover) / per). count up to credit × per + leftover.
 *   Closed from event_night_datetime (event start) on. New rows: raffle_bonus = true, appended to existing ones.
 */
export async function postRaffleBonusTickets(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) {
    return res.status(403).json({ error: 'Please log in or sign up with your own account to get a raffle.' });
  }
  const eventId = parseEventId(req.body?.eventId);
  const count = Number(req.body?.count);
  if (!eventId) return res.status(400).json({ error: 'Please choose an event.' });
  if (!Number.isInteger(count) || count < 1) return res.status(400).json({ error: 'Please enter how many tickets to generate.' });

  const per = rafflePerRefer();
  const client = await pool.connect();
  try {
    const event = await loadComboEvent(eventId);
    if (!event) return res.status(400).json({ error: 'Please choose an event.' });
    if (event.night_passed) {
      return res.status(403).json({ error: 'Bonus raffle tickets closed when the event started.' });
    }

    await client.query('BEGIN');
    const { rows: creditRows } = await client.query(
      `SELECT raffle_refer_credit FROM ${S}.singles WHERE singles_id = $1 FOR UPDATE`,
      [singlesId]
    );
    const credit = Number(creditRows[0]?.raffle_refer_credit) || 0;
    const leftover = await loadBonusLeftover(client, singlesId, per);
    const maxTickets = credit * per + leftover;
    if (count > maxTickets) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: maxTickets ? `You can generate up to ${maxTickets} bonus tickets.` : 'You have no bonus raffle tickets left.'
      });
    }
    const creditsUsed = Math.ceil(Math.max(0, count - leftover) / per);

    const issued = [];
    for (let i = 0; i < count; i += 1) {
      let row = null;
      for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS && !row; attempt += 1) {
        await client.query('SAVEPOINT bonus_ticket');
        try {
          const { rows } = await client.query(
            `INSERT INTO ${S}.raffle_user
               (singles_id, raffle_host_id, event_id, raffle_bonus, raffle_bonus_batch_count, raffle_bonus_credits_used,
                raffle_number, raffle_generated_id, raffle_generate_datetime)
             SELECT $1, $2, $3, true, $4, $5, pick.n, $6, now()
               FROM (
                 SELECT n FROM generate_series(1, 1000) AS n
                  WHERE NOT EXISTS (SELECT 1 FROM ${S}.raffle_user t WHERE t.event_id = $3 AND t.raffle_number = n)
                  ORDER BY random()
                  LIMIT 1
               ) AS pick
             RETURNING raffle_user_id, event_id, raffle_number, raffle_generated_id, raffle_generate_datetime, raffle_bonus`,
            [singlesId, event.raffle_host_id, event.event_id, count, creditsUsed, newVerifyCode()]
          );
          await client.query('RELEASE SAVEPOINT bonus_ticket');
          if (!rows[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'All 1,000 raffle numbers for this event are taken.' });
          }
          row = rows[0];
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT bonus_ticket');
          if (err?.code !== '23505') throw err;
        }
      }
      if (!row) {
        await client.query('ROLLBACK');
        return res.status(503).json({ error: 'Raffle is busy right now. Please try again.' });
      }
      issued.push(row);
    }

    const { rows: updated } = await client.query(
      `UPDATE ${S}.singles SET raffle_refer_credit = raffle_refer_credit - $2
        WHERE singles_id = $1 RETURNING raffle_refer_credit`,
      [singlesId, creditsUsed]
    );
    await client.query('COMMIT');

    const who = await loadSinglesForLog(singlesId).catch(() => ({ email: '', fullname: '' }));
    for (const t of issued) {
      appendRaffleHardCopy({
        raffleNumber: t.raffle_number,
        raffleGenerateId: formatVerifyCode(t.raffle_generated_id),
        raffleGenerateDatetime: t.raffle_generate_datetime,
        singlesId,
        singlesEmail: who.email,
        singlesFullname: who.fullname,
        eventTitle: `${event.event_title} [bonus]`,
        hostFullName: event.host_full_name,
        hostUrl: event.host_url,
        hostEventStart: event.host_event_raffle_start,
        hostEventEnd: event.host_event_raffle_end
      });
    }

    const withEvent = (r) => ({
      ...r,
      event_title: event.event_title,
      event_build_n_address: event.event_build_n_address,
      host_full_name: event.host_full_name
    });
    return res.status(201).json({
      tickets: issued.map((t) => ticketPayload(withEvent(t))),
      referCredit: Number(updated[0]?.raffle_refer_credit) || 0,
      referRemaining: maxTickets - count,
      creditsUsed
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[raffle] bonus generate failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not create your bonus raffles. Please try again.' });
  } finally {
    client.release();
  }
}

const PAYOUT_METHODS = new Set(['paypal', 'venmo']);
const PAYOUT_INFO_MAX = 120;

/**
 * POST /api/raffle/payout { eventId, method: 'paypal' | 'venmo', info } — winner (raffle_status = WINVERIFIED) says
 * where to send the prize. Saved once into paypal_info or venmo_info; admin then sets raffle_prize_paid.
 */
export async function postRafflePayout(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) return res.status(403).json({ error: 'Please log in with your own account.' });
  const eventId = parseEventId(req.body?.eventId);
  const method = String(req.body?.method || '').toLowerCase();
  const info = String(req.body?.info || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!eventId) return res.status(400).json({ error: 'Please choose an event.' });
  if (!PAYOUT_METHODS.has(method)) return res.status(400).json({ error: 'Please choose PayPal or Venmo.' });
  if (info.length < 3 || info.length > PAYOUT_INFO_MAX) {
    return res.status(400).json({ error: `Please enter your ${method === 'paypal' ? 'PayPal' : 'Venmo'} ID.` });
  }
  try {
    const column = method === 'paypal' ? 'paypal_info' : 'venmo_info';
    const { rows } = await pool.query(
      `UPDATE ${S}.raffle_user u
          SET ${column} = $3, ${method === 'paypal' ? 'venmo_info' : 'paypal_info'} = NULL, raffle_status = 'CLAIMED'
         FROM ${S}.raffle_event e, ${S}.raffle_host h
        WHERE u.singles_id = $1 AND u.event_id = $2 AND u.raffle_status = 'WINVERIFIED'
          AND e.event_id = u.event_id AND h.raffle_host_id = e.raffle_host_id
        RETURNING u.raffle_user_id, u.raffle_number, u.raffle_generated_id, e.event_title, h.host_full_name`,
      [singlesId, eventId, info]
    );
    const saved = rows[0];
    if (!saved) {
      return res.status(409).json({ error: 'There is no unclaimed prize for this event, or it was already submitted.' });
    }
    const who = await loadSinglesForLog(singlesId).catch(() => ({ email: '', fullname: '' }));
    appendRaffleHostActionHardCopy('payout', {
      event_id: eventId,
      event_title: saved.event_title,
      host_full_name: saved.host_full_name,
      raffle_number: saved.raffle_number,
      verification_code: formatVerifyCode(saved.raffle_generated_id),
      raffle_user_id: saved.raffle_user_id,
      singles_id: singlesId,
      singles_email: who.email,
      singles_fullname: who.fullname,
      payout_method: method,
      payout_info: info
    });
    sendRafflePayoutEmailFireAndForget(saved.raffle_user_id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[raffle] payout failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not save your payout info. Please try again.' });
  }
}

/**
 * GET /api/raffle/relationships — members related to the caller:
 *   - both hold a generated raffle ticket for the same event (current or past), and/or
 *   - one is the other's raffle referrer (singles.raffle_refer_by_code = other's raffle_refer_code), and/or
 *   - one is the other's member referrer via the Refer Email / Post FB code
 *     (singles.refer_by_code = other's my_refer_code; default DEFAULT_REFER_BY_CODE ignored).
 * → { relationships: [{ singlesId, events: [{ eventId, title, hostName, nightDatetime, eventDate }],
 *                       isMyReferrer, isMyReferee, isMyMemberReferrer, isMyMemberReferee }] }
 */
export async function getRaffleRelationships(req, res) {
  const singlesId = authSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });
  if (req.auth?.guest_demo_login === true) return res.json({ relationships: [] });
  try {
    const [{ rows: eventRows }, { rows: referRows }, { rows: memberReferRows }] = await Promise.all([
      pool.query(
        `SELECT DISTINCT o.singles_id AS other_id, e.event_id, e.event_title, e.event_night_datetime,
                e.event_time_zone, h.host_full_name
           FROM ${S}.raffle_user mine
           JOIN ${S}.raffle_user o
             ON o.event_id = mine.event_id AND o.singles_id <> mine.singles_id AND o.raffle_number IS NOT NULL
           JOIN ${S}.raffle_event e ON e.event_id = mine.event_id
           JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
          WHERE mine.singles_id = $1 AND mine.raffle_number IS NOT NULL
          ORDER BY e.event_night_datetime NULLS LAST, e.event_id`,
        [singlesId]
      ),
      pool.query(
        `SELECT s.singles_id AS other_id,
                (me.raffle_refer_by_code IS NOT NULL AND s.raffle_refer_code = me.raffle_refer_by_code) AS is_my_referrer,
                (me.raffle_refer_code IS NOT NULL AND s.raffle_refer_by_code = me.raffle_refer_code) AS is_my_referee
           FROM ${S}.singles me
           JOIN ${S}.singles s ON s.singles_id <> me.singles_id
          WHERE me.singles_id = $1
            AND ((me.raffle_refer_by_code IS NOT NULL AND s.raffle_refer_code = me.raffle_refer_by_code)
              OR (me.raffle_refer_code IS NOT NULL AND s.raffle_refer_by_code = me.raffle_refer_code))`,
        [singlesId]
      ),
      pool.query(
        `WITH me AS (
           SELECT btrim(COALESCE(my_refer_code::text, '')) AS my_code,
                  btrim(COALESCE(refer_by_code::text, '')) AS by_code
             FROM ${S}.singles WHERE singles_id = $1
         )
         SELECT s.singles_id AS other_id,
                (me.by_code NOT IN ('', $2) AND btrim(COALESCE(s.my_refer_code::text, '')) = me.by_code) AS is_my_referrer,
                (me.my_code NOT IN ('', $2) AND btrim(COALESCE(s.refer_by_code::text, '')) = me.my_code) AS is_my_referee
           FROM ${S}.singles s, me
          WHERE s.singles_id <> $1
            AND ((me.by_code NOT IN ('', $2) AND btrim(COALESCE(s.my_refer_code::text, '')) = me.by_code)
              OR (me.my_code NOT IN ('', $2) AND btrim(COALESCE(s.refer_by_code::text, '')) = me.my_code))`,
        [singlesId, DEFAULT_REFER_BY_CODE]
      )
    ]);

    const byId = new Map();
    const entry = (otherId) => {
      const id = Number(otherId);
      if (!byId.has(id)) {
        byId.set(id, {
          singlesId: id,
          events: [],
          isMyReferrer: false,
          isMyReferee: false,
          isMyMemberReferrer: false,
          isMyMemberReferee: false
        });
      }
      return byId.get(id);
    };
    for (const row of eventRows) {
      entry(row.other_id).events.push({
        eventId: Number(row.event_id),
        title: row.event_title || '',
        hostName: String(row.host_full_name || '').trim(),
        nightDatetime: row.event_night_datetime,
        eventDate: row.event_night_datetime ? formatEventTime(row.event_night_datetime, row.event_time_zone) : ''
      });
    }
    for (const row of referRows) {
      const e = entry(row.other_id);
      e.isMyReferrer = e.isMyReferrer || row.is_my_referrer === true;
      e.isMyReferee = e.isMyReferee || row.is_my_referee === true;
    }
    for (const row of memberReferRows) {
      const e = entry(row.other_id);
      e.isMyMemberReferrer = e.isMyMemberReferrer || row.is_my_referrer === true;
      e.isMyMemberReferee = e.isMyMemberReferee || row.is_my_referee === true;
    }
    return res.json({ relationships: [...byId.values()] });
  } catch (err) {
    console.error('[raffle] relationships failed:', err?.message || err);
    return res.status(500).json({ error: 'Could not load raffle relationships.' });
  }
}
