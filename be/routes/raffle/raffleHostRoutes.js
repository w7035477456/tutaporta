/**
 * /host — raffle host page (public; every action re-checks the host password, no server session).
 *   GET  /api/raffle/host/events   drop-down (event_show_combo = true)
 *   POST /api/raffle/host/login    { eventId, password }
 *   POST /api/raffle/host/draw     { eventId, password } → new winning number (raffle_win = true); 409 once a winner is claimed
 *   POST /api/raffle/host/verify   multipart { eventId, password, winNumber, code, source, image? }
 */
import crypto from 'node:crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcrypt';
import Busboy from 'busboy';
import pool from '../../db/connection.js';
import { appendRaffleHostActionHardCopy } from '../../utils/hardCopyAuthLog.js';
import { formatVerifyCode, loadSinglesForLog } from './raffleRoutes.js';

const S = 'outdateddbsnapshotoct2024';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const VERIFY_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

class HostError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function sendHostError(res, err, fallback) {
  if (err instanceof HostError) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error(`[raffleHost] ${fallback}:`, err?.message || err);
  return res.status(500).json({ error: fallback });
}

function parseEventId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

export function raffleImageFolder() {
  const configured = String(process.env.RAFFLE_FOLDER || '').trim();
  if (configured) return configured;
  const base =
    String(process.env.FAST_STORAGE_FOLDER || '').trim() ||
    path.join(os.homedir(), 'tutamallStorageFolder_outdatedOct2021');
  return path.join(base, 'raffle');
}

/** QR text (https://…/raffle/verify/K7Q4-MZ9X) or typed code → K7Q4MZ9X, or '' when not a valid code. */
function normalizeVerifyCode(raw) {
  let text = String(raw || '').trim();
  const fromUrl = text.match(/\/raffle\/verify\/([A-Za-z0-9-]+)/);
  if (fromUrl) text = fromUrl[1];
  const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return VERIFY_CODE_RE.test(code) ? code : '';
}

/**
 * Load the drop-down event + its host and check the host password (bcrypt).
 * Wrong passwords count toward a lock stored on raffle_host (cluster-wide).
 * Uses 400/423, not 401/403 — the FE axios client treats those as "member logged out".
 */
async function authenticateHost(eventIdRaw, passwordRaw) {
  const eventId = parseEventId(eventIdRaw);
  const password = String(passwordRaw || '');
  if (!eventId) throw new HostError(400, 'Please select your event.');
  if (!password) throw new HostError(400, 'Please enter your host password.');

  const { rows } = await pool.query(
    `SELECT e.event_id, e.event_title, e.raffle_host_id, h.host_full_name, h.host_password_hash,
            h.host_locked_until, (h.host_locked_until IS NOT NULL AND h.host_locked_until > now()) AS locked
       FROM ${S}.raffle_event e
       JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
      WHERE e.event_id = $1 AND e.event_show_combo = true
      LIMIT 1`,
    [eventId]
  );
  const event = rows[0];
  if (!event) throw new HostError(400, 'Please select your event.');
  if (event.locked) {
    throw new HostError(423, 'Too many wrong passwords. Try again in a few minutes.', {
      lockedUntil: event.host_locked_until
    });
  }
  if (!event.host_password_hash) {
    throw new HostError(400, 'No host password is set for this event yet. Ask TutaMall to set one.');
  }

  const ok = await bcrypt.compare(password, event.host_password_hash);
  if (!ok) {
    const { rows: failRows } = await pool.query(
      `UPDATE ${S}.raffle_host
          SET host_failed_attempts = CASE WHEN host_locked_until IS NOT NULL AND host_locked_until <= now()
                                          THEN 1 ELSE host_failed_attempts + 1 END,
              host_locked_until = CASE
                WHEN (CASE WHEN host_locked_until IS NOT NULL AND host_locked_until <= now()
                           THEN 1 ELSE host_failed_attempts + 1 END) >= $2
                THEN now() + make_interval(mins => $3)
                ELSE NULL END
        WHERE raffle_host_id = $1
        RETURNING host_failed_attempts, host_locked_until`,
      [event.raffle_host_id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES]
    );
    const left = Math.max(0, MAX_FAILED_ATTEMPTS - Number(failRows[0]?.host_failed_attempts || 0));
    if (failRows[0]?.host_locked_until) {
      throw new HostError(423, `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.`);
    }
    throw new HostError(400, `Wrong host password. ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  await pool.query(
    `UPDATE ${S}.raffle_host SET host_failed_attempts = 0, host_locked_until = NULL
      WHERE raffle_host_id = $1 AND (host_failed_attempts <> 0 OR host_locked_until IS NOT NULL)`,
    [event.raffle_host_id]
  );
  return event;
}

async function loadDrawCounts(eventId) {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE raffle_number IS NOT NULL)::int AS issued,
            count(*) FILTER (WHERE raffle_number IS NOT NULL AND raffle_win)::int AS drawn,
            count(*) FILTER (WHERE raffle_claimed)::int AS claimed
       FROM ${S}.raffle_user WHERE event_id = $1`,
    [eventId]
  );
  return rows[0] || { issued: 0, drawn: 0, claimed: 0 };
}

/** GET /api/raffle/host/events */
export async function getRaffleHostEvents(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT e.event_id, e.event_title, h.host_full_name
         FROM ${S}.raffle_event e
         JOIN ${S}.raffle_host h ON h.raffle_host_id = e.raffle_host_id
        WHERE e.event_show_combo = true
        ORDER BY e.event_night_datetime NULLS LAST, e.event_id`
    );
    return res.json({
      events: rows.map((r) => ({
        eventId: Number(r.event_id),
        title: r.event_title,
        hostName: r.host_full_name || ''
      }))
    });
  } catch (err) {
    return sendHostError(res, err, 'Could not load events. Please try again.');
  }
}

/** POST /api/raffle/host/login */
export async function postRaffleHostLogin(req, res) {
  try {
    const event = await authenticateHost(req.body?.eventId, req.body?.password);
    const counts = await loadDrawCounts(event.event_id);
    return res.json({
      ok: true,
      eventId: Number(event.event_id),
      eventTitle: event.event_title,
      hostName: event.host_full_name || '',
      ...counts
    });
  } catch (err) {
    return sendHostError(res, err, 'Could not check the host password. Please try again.');
  }
}

const DRAWING_CLOSED_MESSAGE = 'Winner verified — drawing is closed for this event.';

/** Same range as member tickets (raffleRoutes generate_series). */
const RAFFLE_MAX_NUMBER = 1000;

/**
 * POST /api/raffle/host/draw { eventId, password, previousNumber? } — every click draws a NEW random number
 * 1–1000 (never previousNumber) and sets raffle_win = true only on the ticket holding it (if any); every other
 * unclaimed ticket gets raffle_win = false, so a no-show can no longer claim. Closed once a ticket is claimed.
 */
export async function postRaffleHostDraw(req, res) {
  try {
    const event = await authenticateHost(req.body?.eventId, req.body?.password);
    const before = await loadDrawCounts(event.event_id);
    if (before.claimed > 0) throw new HostError(409, DRAWING_CLOSED_MESSAGE, { ...before, closed: true });

    const prev = Number(req.body?.previousNumber);
    let number = crypto.randomInt(1, RAFFLE_MAX_NUMBER + 1);
    while (number === prev) number = crypto.randomInt(1, RAFFLE_MAX_NUMBER + 1);
    const { rows } = await pool.query(
      `UPDATE ${S}.raffle_user SET raffle_win = (raffle_number = $1)
        WHERE event_id = $2 AND raffle_number IS NOT NULL AND raffle_claimed = false
          AND NOT EXISTS (SELECT 1 FROM ${S}.raffle_user c WHERE c.event_id = $2 AND c.raffle_claimed)
        RETURNING raffle_user_id, singles_id, raffle_win`,
      [number, event.event_id]
    );
    const counts = await loadDrawCounts(event.event_id);
    if (counts.claimed > 0) throw new HostError(409, DRAWING_CLOSED_MESSAGE, { ...counts, closed: true });
    const holder = rows.find((r) => r.raffle_win);
    appendRaffleHostActionHardCopy('draw', {
      event_id: event.event_id,
      event_title: event.event_title,
      host_full_name: event.host_full_name,
      winning_raffle_number: number,
      raffle_user_id: holder?.raffle_user_id ?? '',
      singles_id: holder?.singles_id ?? ''
    });
    return res.json({ raffleNumber: number, ...counts });
  } catch (err) {
    return sendHostError(res, err, 'Could not draw a raffle number. Please try again.');
  }
}

function parseHostVerifyMultipart(req) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('multipart/form-data')) return Promise.resolve({ fields: req.body || {}, image: null });
  return new Promise((resolve, reject) => {
    const fields = {};
    let image = null;
    let tooBig = false;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10 } });
    busboy.on('field', (name, value) => {
      fields[name] = value;
    });
    busboy.on('file', (name, stream) => {
      if (name !== 'image') {
        stream.resume();
        return;
      }
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('limit', () => {
        tooBig = true;
      });
      stream.on('end', () => {
        if (!tooBig) image = Buffer.concat(chunks);
      });
    });
    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (tooBig) reject(new HostError(400, 'Photo is too large.'));
      else resolve({ fields, image });
    });
    req.pipe(busboy);
  });
}

function saveScanImage(image, eventId, ticket) {
  if (!image?.length) return '';
  const folder = raffleImageFolder();
  fs.mkdirSync(folder, { recursive: true, mode: 0o750 });
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const base = ticket
    ? `event${eventId}_ru${ticket.raffle_user_id}_sid${ticket.singles_id}_win${ticket.raffle_number}`
    : `event${eventId}_nomatch_${stamp}`;
  let name = `${base}.jpg`;
  if (fs.existsSync(path.join(folder, name))) name = `${base}_${stamp}.jpg`;
  fs.writeFileSync(path.join(folder, name), image, { mode: 0o640, flag: 'wx' });
  return name;
}

/** POST /api/raffle/host/verify — scan (QR photo) or typed verification code; marks raffle_claimed. */
export async function postRaffleHostVerify(req, res) {
  try {
    const { fields, image } = await parseHostVerifyMultipart(req);
    const event = await authenticateHost(fields.eventId, fields.password);
    const source = fields.source === 'scan' ? 'scan' : 'code';
    const code = normalizeVerifyCode(fields.code);
    const winNumber = Number.isInteger(Number(fields.winNumber)) && Number(fields.winNumber) > 0 ? Number(fields.winNumber) : null;

    let ticket = null;
    if (code) {
      const { rows } = await pool.query(
        `SELECT raffle_user_id, singles_id, event_id, raffle_number, raffle_win, raffle_claimed
           FROM ${S}.raffle_user WHERE raffle_generated_id = $1 LIMIT 1`,
        [code]
      );
      ticket = rows[0] || null;
    }

    let status = 'invalid';
    let message;
    if (!code) {
      message =
        source === 'scan'
          ? 'Could not read a raffle QR code in this photo. Try again or type the verification code.'
          : 'Verification code must be 8 letters/numbers (like K7Q4-MZ9X).';
    } else if (!ticket) {
      message = 'NOT VALID — no raffle ticket has this verification code.';
    } else if (Number(ticket.event_id) !== Number(event.event_id)) {
      message = 'NOT VALID — this ticket is for a different event.';
    } else if (winNumber && Number(ticket.raffle_number) !== winNumber) {
      message = `NOT VALID — this ticket is #${ticket.raffle_number}, but the drawn number is #${winNumber}.`;
    } else if (!ticket.raffle_win) {
      message = `NOT VALID — ticket #${ticket.raffle_number} is not the current winning number.`;
    } else if (ticket.raffle_claimed) {
      status = 'already_claimed';
      message = `ALREADY CLAIMED — ticket #${ticket.raffle_number} was already verified.`;
    } else {
      const { rows } = await pool.query(
        `UPDATE ${S}.raffle_user SET raffle_claimed = true, raffle_claimed_datetime = now()
          WHERE raffle_user_id = $1 AND raffle_claimed = false
          RETURNING raffle_user_id`,
        [ticket.raffle_user_id]
      );
      if (rows[0]) {
        status = 'valid';
        message = `VALID WINNER — raffle #${ticket.raffle_number}. Prize claimed.`;
      } else {
        status = 'already_claimed';
        message = `ALREADY CLAIMED — ticket #${ticket.raffle_number} was already verified.`;
      }
    }

    const matchedTicket = ticket && Number(ticket.event_id) === Number(event.event_id) ? ticket : null;
    let imageFile = '';
    try {
      imageFile = saveScanImage(image, event.event_id, matchedTicket);
    } catch (err) {
      console.error('[raffleHost] save scan image failed:', err?.message || err);
    }
    const member = matchedTicket ? await loadSinglesForLog(matchedTicket.singles_id) : null;

    appendRaffleHostActionHardCopy(source, {
      event_id: event.event_id,
      event_title: event.event_title,
      host_full_name: event.host_full_name,
      verification_code: code ? formatVerifyCode(code) : String(fields.code || '').slice(0, 80),
      drawn_number: winNumber || '',
      result: status,
      raffle_number: ticket?.raffle_number ?? '',
      raffle_user_id: ticket?.raffle_user_id ?? '',
      singles_id: ticket?.singles_id ?? '',
      singles_fullname: member?.fullname || '',
      image_file: imageFile
    });

    const counts = await loadDrawCounts(event.event_id);
    return res.json({
      status,
      valid: status === 'valid',
      message,
      raffleNumber: ticket ? Number(ticket.raffle_number) : null,
      memberName: status === 'valid' || status === 'already_claimed' ? member?.fullname || '' : '',
      verifyCode: code ? formatVerifyCode(code) : '',
      ...counts
    });
  } catch (err) {
    return sendHostError(res, err, 'Could not verify the raffle ticket. Please try again.');
  }
}
