import crypto from 'crypto';
import pool from '../db/connection.js';
import { getRequestClientIp } from './adminIpConfig.js';

const SCHEMA = 'helloworldjunktest';

/** Never write login_log for these client IPs (local / home). */
const LOGIN_LOG_SKIP_IPS = new Set(['127.0.0.1', '72.83.247.73']);

function normalizeInet(raw) {
  let ip = String(raw ?? '').trim();
  if (!ip || ip === 'unknown') return null;
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  return ip;
}

/** True when this IP must not be recorded in login_log at all. */
export function shouldSkipLoginLogIp(rawIp) {
  const ip = normalizeInet(rawIp);
  if (!ip) return false;
  return LOGIN_LOG_SKIP_IPS.has(ip);
}

function userAgentFromReq(req) {
  const ua = req?.headers?.['user-agent'];
  return typeof ua === 'string' && ua.trim() ? ua.trim().slice(0, 2000) : null;
}

/** @returns {string} */
export function createLoginLogSessionToken() {
  return crypto.randomUUID();
}

/**
 * Record demo/guest alias login (demo/demo, guest/guest).
 * Never throws to callers — login must succeed even if logging fails.
 *
 * @param {import('express').Request | null | undefined} req
 * @param {{
 *   singlesId?: number | null,
 *   email?: string | null,
 *   phone?: string | null,
 *   sessionToken?: string | null,
 *   clientIp?: string | null
 * }} fields
 * @returns {Promise<number | null>} login_log_id or null
 */
export async function insertDemoLoginLog(req, fields = {}) {
  try {
    const singlesIdRaw = Number(fields.singlesId);
    const singlesId = Number.isFinite(singlesIdRaw) && singlesIdRaw > 0 ? singlesIdRaw : null;
    const email = String(fields.email ?? '').trim() || null;
    const phone = String(fields.phone ?? '').trim() || null;
    const sessionToken = String(fields.sessionToken ?? '').trim() || null;
    const clientIp = normalizeInet(fields.clientIp ?? (req ? getRequestClientIp(req) : null));
    if (shouldSkipLoginLogIp(clientIp)) return null;
    const userAgent = userAgentFromReq(req);

    const { rows } = await pool.query(
      `INSERT INTO ${SCHEMA}.login_log (
         event_type, is_demo, singles_id, email, phone, client_ip, user_agent, session_token
       ) VALUES (
         'demo_login'::${SCHEMA}.login_log_event_type,
         true,
         $1, $2, $3, $4::inet, $5, $6
       )
       RETURNING login_log_id`,
      [singlesId, email, phone, clientIp, userAgent, sessionToken]
    );
    return rows[0]?.login_log_id != null ? Number(rows[0].login_log_id) : null;
  } catch (err) {
    console.error('[loginLog] insertDemoLoginLog failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Record signup intent (Sign Up form) or completed account creation.
 * Never throws — signup must succeed even if logging fails.
 * @returns {Promise<number | null>}
 */
export async function insertSignupLoginLog(req, fields = {}) {
  try {
    const singlesIdRaw = Number(fields.singlesId);
    const singlesId = Number.isFinite(singlesIdRaw) && singlesIdRaw > 0 ? singlesIdRaw : null;
    const email = String(fields.email ?? '').trim();
    const phone = String(fields.phone ?? '').trim();
    if (!email || !phone) {
      console.error('[loginLog] insertSignupLoginLog skip: email and phone required');
      return null;
    }
    const sessionToken = String(fields.sessionToken ?? '').trim() || null;
    const clientIp = normalizeInet(fields.clientIp ?? (req ? getRequestClientIp(req) : null));
    if (shouldSkipLoginLogIp(clientIp)) return null;
    const userAgent = userAgentFromReq(req);

    const { rows } = await pool.query(
      `INSERT INTO ${SCHEMA}.login_log (
         event_type, is_demo, singles_id, email, phone, client_ip, user_agent, session_token
       ) VALUES (
         'signup'::${SCHEMA}.login_log_event_type,
         false,
         $1, $2, $3, $4::inet, $5, $6
       )
       RETURNING login_log_id`,
      [singlesId, email, phone, clientIp, userAgent, sessionToken]
    );
    return rows[0]?.login_log_id != null ? Number(rows[0].login_log_id) : null;
  } catch (err) {
    console.error('[loginLog] insertSignupLoginLog failed:', err?.message ?? err);
    return null;
  }
}

/**
 * After singles row is created: attach singles_id to the latest signup row for this email,
 * or insert a new signup row if none exists (e.g. legacy / alternate paths).
 * @returns {Promise<number | null>}
 */
export async function attachOrInsertSignupLoginLog(req, fields = {}) {
  try {
    const singlesIdRaw = Number(fields.singlesId);
    const singlesId = Number.isFinite(singlesIdRaw) && singlesIdRaw > 0 ? singlesIdRaw : null;
    const email = String(fields.email ?? '').trim();
    const phone = String(fields.phone ?? '').trim();
    if (!email || !phone || !singlesId) {
      return insertSignupLoginLog(req, fields);
    }

    const { rows } = await pool.query(
      `UPDATE ${SCHEMA}.login_log ll
       SET singles_id = $1,
           phone = COALESCE(NULLIF(TRIM(ll.phone), ''), $3),
           updated_at = now()
       WHERE ll.login_log_id = (
         SELECT x.login_log_id
         FROM ${SCHEMA}.login_log x
         WHERE x.event_type = 'signup'::${SCHEMA}.login_log_event_type
           AND lower(TRIM(x.email)) = lower(TRIM($2))
           AND x.singles_id IS NULL
         ORDER BY x.login_at DESC, x.login_log_id DESC
         LIMIT 1
       )
       RETURNING ll.login_log_id`,
      [singlesId, email, phone]
    );
    if (rows[0]?.login_log_id != null) {
      return Number(rows[0].login_log_id);
    }
    return insertSignupLoginLog(req, { ...fields, singlesId, email, phone });
  } catch (err) {
    console.error('[loginLog] attachOrInsertSignupLoginLog failed:', err?.message ?? err);
    return insertSignupLoginLog(req, fields);
  }
}

const LOGOUT_REASONS = new Set(['user_logout', 'auto_logout', 'browser_close', 'session_superseded', 'other']);

/**
 * Close open login_log row(s) for a session token (demo) or singles_id open session.
 * @param {{
 *   sessionToken?: string | null,
 *   singlesId?: number | null,
 *   reason?: string,
 *   onlyDemo?: boolean
 * }} opts
 */
export async function closeLoginLogSession({
  sessionToken = null,
  singlesId = null,
  reason = 'user_logout',
  onlyDemo = false
} = {}) {
  try {
    const token = String(sessionToken ?? '').trim();
    const sidRaw = Number(singlesId);
    const sid = Number.isFinite(sidRaw) && sidRaw > 0 ? sidRaw : null;
    if (!token && !sid) return 0;

    const logoutReason = LOGOUT_REASONS.has(String(reason ?? '').trim())
      ? String(reason).trim()
      : 'other';

    const params = [];
    let where;
    if (token) {
      params.push(token);
      where = `session_token = $1 AND logout_at IS NULL`;
    } else {
      params.push(sid);
      where = `singles_id = $1 AND logout_at IS NULL`;
      if (onlyDemo) {
        where += ` AND is_demo = true`;
      }
    }
    params.push(logoutReason);

    const { rowCount } = await pool.query(
      `UPDATE ${SCHEMA}.login_log
       SET logout_at = now(),
           online_seconds = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - login_at)))::integer),
           logout_reason = $${params.length}::${SCHEMA}.login_log_logout_reason,
           updated_at = now()
       WHERE ${where}`,
      params
    );
    return rowCount ?? 0;
  } catch (err) {
    console.error('[loginLog] closeLoginLogSession failed:', err?.message ?? err);
    return 0;
  }
}
