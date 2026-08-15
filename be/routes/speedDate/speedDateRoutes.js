import pool from '../../db/connection.js';
import { isAdminAuth } from '../../utils/adminAuth.js';
import { ensureSpeedDateSchema } from '../../utils/speedDateSchema.js';
import { getSpeedDateIceServers } from '../../utils/speedDateIceConfig.js';
import { buildRoundPairs } from '../../utils/speedDatePairing.js';

const SPEED_DATE_LOCK_NS = 872001;
const MAX_SIGNALS_PER_POLL = 40;
const MAX_ICE_PER_POST = 24;

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toIntOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function trimText(value, maxLen) {
  const s = String(value ?? '').trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function sendError(res, error, fallback = 'Speed dating request failed') {
  const statusCode = Number(error?.statusCode) || 500;
  const message = statusCode < 500 ? error?.message || fallback : fallback;
  if (statusCode >= 500) console.error('[speed-date]', error);
  return res.status(statusCode).json({ error: message });
}

function mapMemberRow(row) {
  if (!row) return null;
  const singlesId = Number(row.singles_id);
  return {
    singles_id: singlesId,
    alias: row.alias ?? null,
    prefix: row.prefix ?? null,
    member_id: row.member_id ?? null,
    gender: row.gender ?? null,
    profile_image_fk: row.profile_image_fk != null ? Number(row.profile_image_fk) : null
  };
}

function mapEventRow(row) {
  if (!row) return null;
  return {
    event_id: Number(row.event_id),
    host_singles_id: row.host_singles_id != null ? Number(row.host_singles_id) : null,
    title: row.title,
    status: row.status,
    mix_mode: row.mix_mode,
    round_minutes: Number(row.round_minutes),
    intermission_seconds: Number(row.intermission_seconds),
    max_participants: Number(row.max_participants),
    max_rounds: Number(row.max_rounds),
    current_round_no: Number(row.current_round_no),
    starts_at: row.starts_at,
    zoom_lobby_url: row.zoom_lobby_url || null,
    rsvp_count: row.rsvp_count != null ? Number(row.rsvp_count) : undefined,
    ready_count: row.ready_count != null ? Number(row.ready_count) : undefined,
    created_at: row.created_at
  };
}

async function loadJoinedMembers(client, eventId) {
  const result = await client.query(
    `
    SELECT
      r.singles_id,
      s.alias,
      s.prefix,
      s.member_id,
      s.profile_image_fk,
      COALESCE(NULLIF(s.gender_self_report, ''), NULLIF(s.dl_sex, '')) AS gender
    FROM helloworldjunktest.speed_date_rsvp r
    JOIN helloworldjunktest.singles s ON s.singles_id = r.singles_id
    WHERE r.event_id = $1
      AND r.status = 'joined'
    ORDER BY r.created_at ASC, r.singles_id ASC
    `,
    [eventId]
  );
  return result.rows.map(mapMemberRow);
}

async function loadPreviousPairKeys(client, eventId) {
  const result = await client.query(
    `
    SELECT singles_low, singles_high
    FROM helloworldjunktest.speed_date_pair
    WHERE event_id = $1
    `,
    [eventId]
  );
  return new Set(result.rows.map((row) => `${Number(row.singles_low)}_${Number(row.singles_high)}`));
}

async function insertRoundPairs(client, event, members) {
  const previous = await loadPreviousPairKeys(client, event.event_id);
  const nextNo = Number(event.current_round_no) + 1;
  const { pairs, sitOuts } = buildRoundPairs(members, previous, event.mix_mode, nextNo);
  if (!pairs.length) {
    throw httpError(400, 'No new unique pairs left. End the event or add more guests.');
  }

  const roundMinutes = Number(event.round_minutes) || 20;
  const insertedRound = await client.query(
    `
    INSERT INTO helloworldjunktest.speed_date_round (event_id, round_no, status, started_at, ends_at)
    VALUES ($1, $2, 'live', NOW(), NOW() + ($3::int * INTERVAL '1 minute'))
    RETURNING round_id, event_id, round_no, status, started_at, ends_at
    `,
    [event.event_id, nextNo, roundMinutes]
  );
  const round = insertedRound.rows[0];

  for (const [low, high] of pairs) {
    await client.query(
      `
      INSERT INTO helloworldjunktest.speed_date_pair
        (event_id, round_id, singles_low, singles_high)
      VALUES ($1, $2, $3, $4)
      `,
      [event.event_id, round.round_id, low, high]
    );
  }
  for (const sitId of sitOuts) {
    await client.query(
      `
      INSERT INTO helloworldjunktest.speed_date_sitout (round_id, singles_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [round.round_id, sitId]
    );
  }

  await client.query(
    `
    UPDATE helloworldjunktest.speed_date_event
    SET status = 'live',
        current_round_no = $2,
        updated_at = NOW()
    WHERE event_id = $1
    `,
    [event.event_id, nextNo]
  );

  return { round, pairCount: pairs.length, sitOutCount: sitOuts.length };
}

async function maybeAdvanceEvent(client, eventId) {
  const locked = await client.query(
    `SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS ok`,
    [SPEED_DATE_LOCK_NS, eventId]
  );
  if (!locked.rows[0]?.ok) return { advanced: false };

  const eventRes = await client.query(
    `SELECT * FROM helloworldjunktest.speed_date_event WHERE event_id = $1 FOR UPDATE`,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event || event.status !== 'live') return { advanced: false, event };

  const current = await client.query(
    `
    SELECT *
    FROM helloworldjunktest.speed_date_round
    WHERE event_id = $1
    ORDER BY round_no DESC
    LIMIT 1
    FOR UPDATE
    `,
    [eventId]
  );
  const round = current.rows[0];
  if (!round) return { advanced: false, event };

  const nowRes = await client.query(`SELECT NOW() AS now`);
  const now = nowRes.rows[0].now;

  if (round.status === 'live' && new Date(round.ends_at).getTime() <= new Date(now).getTime()) {
    const intermission = Number(event.intermission_seconds) || 0;
    if (intermission > 0) {
      await client.query(
        `
        UPDATE helloworldjunktest.speed_date_round
        SET status = 'intermission',
            ends_at = NOW() + ($2::int * INTERVAL '1 second')
        WHERE round_id = $1
        `,
        [round.round_id, intermission]
      );
      return { advanced: true, event };
    }
    await client.query(
      `UPDATE helloworldjunktest.speed_date_round SET status = 'ended' WHERE round_id = $1`,
      [round.round_id]
    );
  }

  const refreshedRound = await client.query(
    `SELECT * FROM helloworldjunktest.speed_date_round WHERE round_id = $1`,
    [round.round_id]
  );
  const liveRound = refreshedRound.rows[0];
  if (liveRound.status === 'intermission' && new Date(liveRound.ends_at).getTime() <= new Date(now).getTime()) {
    await client.query(
      `UPDATE helloworldjunktest.speed_date_round SET status = 'ended' WHERE round_id = $1`,
      [liveRound.round_id]
    );
  }

  const after = await client.query(
    `SELECT * FROM helloworldjunktest.speed_date_round WHERE round_id = $1`,
    [round.round_id]
  );
  const doneRound = after.rows[0];
  if (doneRound.status !== 'ended') return { advanced: false, event };

  if (Number(event.current_round_no) >= Number(event.max_rounds)) {
    await client.query(
      `
      UPDATE helloworldjunktest.speed_date_event
      SET status = 'ended', updated_at = NOW()
      WHERE event_id = $1
      `,
      [eventId]
    );
    return { advanced: true, event: { ...event, status: 'ended' } };
  }

  const members = await loadJoinedMembers(client, eventId);
  try {
    await insertRoundPairs(client, event, members);
    return { advanced: true, event };
  } catch (error) {
    if (error?.statusCode === 400) {
      await client.query(
        `
        UPDATE helloworldjunktest.speed_date_event
        SET status = 'ended', updated_at = NOW()
        WHERE event_id = $1
        `,
        [eventId]
      );
      return { advanced: true, event: { ...event, status: 'ended' } };
    }
    throw error;
  }
}

async function loadSessionPayload(me, eventId, isAdmin) {
  const eventRes = await pool.query(
    `
    SELECT
      e.*,
      (
        SELECT count(*)::int
        FROM helloworldjunktest.speed_date_rsvp r
        WHERE r.event_id = e.event_id AND r.status = 'joined'
      ) AS rsvp_count,
      (
        SELECT count(*)::int
        FROM helloworldjunktest.speed_date_rsvp r
        WHERE r.event_id = e.event_id AND r.status = 'joined' AND r.camera_ready = true
      ) AS ready_count
    FROM helloworldjunktest.speed_date_event e
    WHERE e.event_id = $1
    `,
    [eventId]
  );
  const event = eventRes.rows[0];
  if (!event) throw httpError(404, 'Speed dating event not found');

  const rsvpRes = await pool.query(
    `
    SELECT status, camera_ready, last_seen_at
    FROM helloworldjunktest.speed_date_rsvp
    WHERE event_id = $1 AND singles_id = $2
    `,
    [eventId, me]
  );
  const myRsvp = rsvpRes.rows[0]
    ? {
        status: rsvpRes.rows[0].status,
        camera_ready: rsvpRes.rows[0].camera_ready === true,
        last_seen_at: rsvpRes.rows[0].last_seen_at
      }
    : null;

  const roundRes = await pool.query(
    `
    SELECT round_id, event_id, round_no, status, started_at, ends_at
    FROM helloworldjunktest.speed_date_round
    WHERE event_id = $1
    ORDER BY round_no DESC
    LIMIT 1
    `,
    [eventId]
  );
  const round = roundRes.rows[0]
    ? {
        round_id: Number(roundRes.rows[0].round_id),
        round_no: Number(roundRes.rows[0].round_no),
        status: roundRes.rows[0].status,
        started_at: roundRes.rows[0].started_at,
        ends_at: roundRes.rows[0].ends_at,
        remaining_ms: Math.max(0, new Date(roundRes.rows[0].ends_at).getTime() - Date.now())
      }
    : null;

  let pair = null;
  let sittingOut = false;
  if (round) {
    const pairRes = await pool.query(
      `
      SELECT pair_id, singles_low, singles_high, low_want_meet, high_want_meet
      FROM helloworldjunktest.speed_date_pair
      WHERE round_id = $1
        AND (singles_low = $2 OR singles_high = $2)
      LIMIT 1
      `,
      [round.round_id, me]
    );
    const pairRow = pairRes.rows[0];
    if (pairRow) {
      const partnerId =
        Number(pairRow.singles_low) === Number(me) ? Number(pairRow.singles_high) : Number(pairRow.singles_low);
      const partnerRes = await pool.query(
        `
        SELECT
          singles_id, alias, prefix, member_id, profile_image_fk,
          COALESCE(NULLIF(gender_self_report, ''), NULLIF(dl_sex, '')) AS gender
        FROM helloworldjunktest.singles
        WHERE singles_id = $1
        `,
        [partnerId]
      );
      const isLow = Number(pairRow.singles_low) === Number(me);
      pair = {
        pair_id: Number(pairRow.pair_id),
        partner: mapMemberRow(partnerRes.rows[0]),
        is_offerer: Number(me) === Number(pairRow.singles_low),
        my_want_meet: isLow ? pairRow.low_want_meet : pairRow.high_want_meet,
        partner_want_meet: isLow ? pairRow.high_want_meet : pairRow.low_want_meet,
        mutual_want_meet:
          pairRow.low_want_meet === true && pairRow.high_want_meet === true
      };
    } else {
      const sitRes = await pool.query(
        `
        SELECT 1
        FROM helloworldjunktest.speed_date_sitout
        WHERE round_id = $1 AND singles_id = $2
        `,
        [round.round_id, me]
      );
      sittingOut = sitRes.rows.length > 0;
    }
  }

  let guests = [];
  if (isAdmin || event.status === 'open' || event.status === 'live') {
    guests = await loadJoinedMembers(pool, eventId);
  }

  return {
    event: mapEventRow(event),
    my_rsvp: myRsvp,
    round,
    pair,
    sitting_out: sittingOut,
    guests: isAdmin ? guests : guests.map((g) => ({ singles_id: g.singles_id, alias: g.alias })),
    ice_servers: getSpeedDateIceServers(),
    is_host: isAdmin || Number(event.host_singles_id) === Number(me)
  };
}

export async function listSpeedDateEvents(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me && !isAdminAuth(req.auth)) return res.status(401).json({ error: 'Authentication required' });
  try {
    await ensureSpeedDateSchema();
    const result = await pool.query(
      `
      SELECT
        e.*,
        (
          SELECT count(*)::int
          FROM helloworldjunktest.speed_date_rsvp r
          WHERE r.event_id = e.event_id AND r.status = 'joined'
        ) AS rsvp_count
      FROM helloworldjunktest.speed_date_event e
      WHERE e.status IN ('draft', 'open', 'live')
         OR (e.status = 'ended' AND e.updated_at > NOW() - INTERVAL '12 hours')
      ORDER BY
        CASE e.status WHEN 'live' THEN 0 WHEN 'open' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        e.starts_at NULLS LAST,
        e.event_id DESC
      LIMIT 40
      `
    );
    const isAdmin = isAdminAuth(req.auth);
    const events = result.rows
      .filter((row) => isAdmin || row.status !== 'draft')
      .map(mapEventRow);
    return res.json({ events, is_admin: isAdmin });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createSpeedDateEvent(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin access required' });
  try {
    await ensureSpeedDateSchema();
    const title = trimText(req.body?.title, 120) || 'Friday Speed Dating';
    const mixMode = String(req.body?.mix_mode ?? 'gender').trim().toLowerCase() === 'random' ? 'random' : 'gender';
    const roundMinutes = clampInt(req.body?.round_minutes, 1, 60, 20);
    const intermissionSeconds = clampInt(req.body?.intermission_seconds, 0, 600, 60);
    const maxParticipants = clampInt(req.body?.max_participants, 2, 80, 50);
    const maxRounds = clampInt(req.body?.max_rounds, 1, 30, 6);
    const startsAtRaw = String(req.body?.starts_at ?? '').trim();
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const zoomLobbyUrl = trimText(req.body?.zoom_lobby_url, 500);
    const inserted = await pool.query(
      `
      INSERT INTO helloworldjunktest.speed_date_event (
        host_singles_id, title, status, mix_mode, round_minutes, intermission_seconds,
        max_participants, max_rounds, starts_at, zoom_lobby_url
      )
      VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        me || null,
        title,
        mixMode,
        roundMinutes,
        intermissionSeconds,
        maxParticipants,
        maxRounds,
        startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt.toISOString() : null,
        zoomLobbyUrl || null
      ]
    );
    return res.status(201).json({ event: mapEventRow(inserted.rows[0]) });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function rsvpSpeedDateEvent(req, res) {
  const me = toInt(req.auth?.singles_id);
  const eventId = toInt(req.params?.eventId);
  const leave = req.body?.leave === true;
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  try {
    await ensureSpeedDateSchema();
    const eventRes = await pool.query(
      `SELECT event_id, status, max_participants FROM helloworldjunktest.speed_date_event WHERE event_id = $1`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) throw httpError(404, 'Speed dating event not found');
    if (leave) {
      await pool.query(
        `
        UPDATE helloworldjunktest.speed_date_rsvp
        SET status = 'left', camera_ready = false, last_seen_at = NOW()
        WHERE event_id = $1 AND singles_id = $2
        `,
        [eventId, me]
      );
      return res.json({ ok: true, joined: false });
    }
    if (event.status !== 'open' && event.status !== 'live') {
      throw httpError(400, 'This speed dating event is not accepting RSVPs.');
    }
    const countRes = await pool.query(
      `
      SELECT count(*)::int AS n
      FROM helloworldjunktest.speed_date_rsvp
      WHERE event_id = $1 AND status = 'joined' AND singles_id <> $2
      `,
      [eventId, me]
    );
    if (Number(countRes.rows[0]?.n) >= Number(event.max_participants)) {
      throw httpError(400, 'This event is full.');
    }
    await pool.query(
      `
      INSERT INTO helloworldjunktest.speed_date_rsvp (event_id, singles_id, status, last_seen_at, camera_ready)
      VALUES ($1, $2, 'joined', NOW(), false)
      ON CONFLICT (event_id, singles_id)
      DO UPDATE SET status = 'joined', last_seen_at = NOW()
      `,
      [eventId, me]
    );
    return res.json({ ok: true, joined: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function heartbeatSpeedDate(req, res) {
  const me = toInt(req.auth?.singles_id);
  const eventId = toInt(req.params?.eventId);
  if (!me || !eventId) return res.status(400).json({ error: 'eventId is required' });
  try {
    await ensureSpeedDateSchema();
    const cameraReady = req.body?.camera_ready === true;
    await pool.query(
      `
      UPDATE helloworldjunktest.speed_date_rsvp
      SET last_seen_at = NOW(), camera_ready = $3
      WHERE event_id = $1 AND singles_id = $2 AND status = 'joined'
      `,
      [eventId, me, cameraReady]
    );
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getSpeedDateSession(req, res) {
  const me = toInt(req.auth?.singles_id);
  if (!me && !isAdminAuth(req.auth)) return res.status(401).json({ error: 'Authentication required' });
  try {
    await ensureSpeedDateSchema();
    let eventId = toInt(req.query?.eventId);
    if (!eventId) {
      const pick = await pool.query(
        `
        SELECT event_id
        FROM helloworldjunktest.speed_date_event
        WHERE status IN ('live', 'open')
        ORDER BY CASE status WHEN 'live' THEN 0 ELSE 1 END, event_id DESC
        LIMIT 1
        `
      );
      eventId = toInt(pick.rows[0]?.event_id);
    }
    if (!eventId) return res.json({ event: null });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await maybeAdvanceEvent(client, eventId);
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      client.release();
    }

    const payload = await loadSessionPayload(me || toIntOrZero(req.auth?.singles_id) || 0, eventId, isAdminAuth(req.auth));
    return res.json(payload);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function startSpeedDateEvent(req, res) {
  if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin access required' });
  const eventId = toInt(req.params?.eventId);
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  const client = await pool.connect();
  try {
    await ensureSpeedDateSchema();
    await client.query('BEGIN');
    const eventRes = await client.query(
      `SELECT * FROM helloworldjunktest.speed_date_event WHERE event_id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) throw httpError(404, 'Speed dating event not found');
    if (event.status === 'ended' || event.status === 'canceled') {
      throw httpError(400, 'This event has already finished.');
    }
    if (Number(event.current_round_no) > 0) {
      throw httpError(400, 'This event already has a round in progress. Use Next round.');
    }
    const members = await loadJoinedMembers(client, eventId);
    if (members.length < 2) throw httpError(400, 'Need at least 2 RSVPs to start.');
    const started = await insertRoundPairs(client, event, members);
    await client.query('COMMIT');
    return res.json({ ok: true, ...started, round: { round_id: Number(started.round.round_id), round_no: Number(started.round.round_no) } });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function nextSpeedDateRound(req, res) {
  if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin access required' });
  const eventId = toInt(req.params?.eventId);
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  const client = await pool.connect();
  try {
    await ensureSpeedDateSchema();
    await client.query('BEGIN');
    const eventRes = await client.query(
      `SELECT * FROM helloworldjunktest.speed_date_event WHERE event_id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = eventRes.rows[0];
    if (!event) throw httpError(404, 'Speed dating event not found');
    if (event.status !== 'live') throw httpError(400, 'Start the event before advancing rounds.');

    await client.query(
      `
      UPDATE helloworldjunktest.speed_date_round
      SET status = 'ended'
      WHERE event_id = $1 AND status IN ('live', 'intermission')
      `,
      [eventId]
    );

    if (Number(event.current_round_no) >= Number(event.max_rounds)) {
      await client.query(
        `UPDATE helloworldjunktest.speed_date_event SET status = 'ended', updated_at = NOW() WHERE event_id = $1`,
        [eventId]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, ended: true });
    }

    const members = await loadJoinedMembers(client, eventId);
    const started = await insertRoundPairs(client, event, members);
    await client.query('COMMIT');
    return res.json({ ok: true, ...started, round: { round_id: Number(started.round.round_id), round_no: Number(started.round.round_no) } });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function endSpeedDateEvent(req, res) {
  if (!isAdminAuth(req.auth)) return res.status(403).json({ error: 'Admin access required' });
  const eventId = toInt(req.params?.eventId);
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });
  try {
    await ensureSpeedDateSchema();
    await pool.query(
      `
      UPDATE helloworldjunktest.speed_date_round
      SET status = 'ended'
      WHERE event_id = $1 AND status IN ('live', 'intermission')
      `,
      [eventId]
    );
    await pool.query(
      `
      UPDATE helloworldjunktest.speed_date_event
      SET status = 'ended', updated_at = NOW()
      WHERE event_id = $1
      `,
      [eventId]
    );
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function postSpeedDateSignal(req, res) {
  const me = toInt(req.auth?.singles_id);
  const pairId = toInt(req.body?.pair_id);
  const kind = String(req.body?.kind ?? '').trim().toLowerCase();
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!pairId) return res.status(400).json({ error: 'pair_id is required' });
  if (!['offer', 'answer', 'ice'].includes(kind)) return res.status(400).json({ error: 'kind must be offer, answer, or ice' });
  const payload = req.body?.payload;
  if (payload == null || typeof payload !== 'object') {
    return res.status(400).json({ error: 'payload is required' });
  }
  try {
    await ensureSpeedDateSchema();
    const pairRes = await pool.query(
      `
      SELECT p.pair_id, p.singles_low, p.singles_high, r.status AS round_status
      FROM helloworldjunktest.speed_date_pair p
      JOIN helloworldjunktest.speed_date_round r ON r.round_id = p.round_id
      WHERE p.pair_id = $1
      `,
      [pairId]
    );
    const pair = pairRes.rows[0];
    if (!pair) throw httpError(404, 'Pair not found');
    if (Number(pair.singles_low) !== me && Number(pair.singles_high) !== me) {
      throw httpError(403, 'Not in this video pair');
    }
    if (pair.round_status !== 'live') throw httpError(400, 'This round is not live');

    if (kind === 'ice') {
      const countRes = await pool.query(
        `
        SELECT count(*)::int AS n
        FROM helloworldjunktest.speed_date_signal
        WHERE pair_id = $1 AND from_singles_id = $2 AND kind = 'ice'
        `,
        [pairId, me]
      );
      if (Number(countRes.rows[0]?.n) >= 80) {
        throw httpError(429, 'Too many ICE candidates');
      }
    } else {
      await pool.query(
        `DELETE FROM helloworldjunktest.speed_date_signal WHERE pair_id = $1 AND from_singles_id = $2 AND kind IN ('offer', 'answer', 'ice')`,
        [pairId, me]
      );
    }

    const inserted = await pool.query(
      `
      INSERT INTO helloworldjunktest.speed_date_signal (pair_id, from_singles_id, kind, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING signal_id
      `,
      [pairId, me, kind, JSON.stringify(payload)]
    );
    return res.status(201).json({ signal_id: Number(inserted.rows[0].signal_id) });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getSpeedDateSignals(req, res) {
  const me = toInt(req.auth?.singles_id);
  const pairId = toInt(req.query?.pairId);
  const afterId = Math.max(0, toIntOrZero(req.query?.afterId));
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!pairId) return res.status(400).json({ error: 'pairId is required' });
  try {
    await ensureSpeedDateSchema();
    const pairRes = await pool.query(
      `
      SELECT pair_id, singles_low, singles_high
      FROM helloworldjunktest.speed_date_pair
      WHERE pair_id = $1
      `,
      [pairId]
    );
    const pair = pairRes.rows[0];
    if (!pair) throw httpError(404, 'Pair not found');
    if (Number(pair.singles_low) !== me && Number(pair.singles_high) !== me) {
      throw httpError(403, 'Not in this video pair');
    }
    const result = await pool.query(
      `
      SELECT signal_id, kind, payload, from_singles_id, created_at
      FROM helloworldjunktest.speed_date_signal
      WHERE pair_id = $1
        AND from_singles_id <> $2
        AND signal_id > $3
      ORDER BY signal_id ASC
      LIMIT $4
      `,
      [pairId, me, afterId, MAX_SIGNALS_PER_POLL]
    );
    return res.json({
      signals: result.rows.map((row) => ({
        signal_id: Number(row.signal_id),
        kind: row.kind,
        payload: row.payload,
        created_at: row.created_at
      }))
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function postSpeedDateInterest(req, res) {
  const me = toInt(req.auth?.singles_id);
  const pairId = toInt(req.params?.pairId);
  if (!me) return res.status(401).json({ error: 'Authentication required' });
  if (!pairId) return res.status(400).json({ error: 'pairId is required' });
  const want = req.body?.want_meet === true;
  try {
    await ensureSpeedDateSchema();
    const pairRes = await pool.query(
      `
      SELECT pair_id, singles_low, singles_high
      FROM helloworldjunktest.speed_date_pair
      WHERE pair_id = $1
      `,
      [pairId]
    );
    const pair = pairRes.rows[0];
    if (!pair) throw httpError(404, 'Pair not found');
    const isLow = Number(pair.singles_low) === me;
    const isHigh = Number(pair.singles_high) === me;
    if (!isLow && !isHigh) throw httpError(403, 'Not in this video pair');
    const column = isLow ? 'low_want_meet' : 'high_want_meet';
    const updated = await pool.query(
      `
      UPDATE helloworldjunktest.speed_date_pair
      SET ${column} = $2
      WHERE pair_id = $1
      RETURNING low_want_meet, high_want_meet
      `,
      [pairId, want]
    );
    const row = updated.rows[0];
    return res.json({
      ok: true,
      my_want_meet: want,
      mutual_want_meet: row.low_want_meet === true && row.high_want_meet === true
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export { MAX_ICE_PER_POST };
