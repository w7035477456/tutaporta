import pool from '../db/connection.js';
import { invalidateAuthUserCache } from './authUserLookupCache.js';
import {
  getCachedCustomLogoutMinutes,
  setCachedCustomLogoutMinutes
} from './customLogoutDurationCache.js';

/** Profiles first preset from LOGOUT_AUTO_MIN (default 15). */
export function parseLogoutAutoMinutes(env = process.env) {
  const raw = String(env.LOGOUT_AUTO_MIN ?? '').trim();
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

/** Preset minutes shown on Profiles — first entry follows LOGOUT_AUTO_MIN. */
export function getLogoutDurationPresets(env = process.env) {
  const autoMin = parseLogoutAutoMinutes(env);
  return [...new Set([autoMin, 60, 480, 1440])].sort((a, b) => a - b);
}

export function buildLogoutDurationPresetSet(env = process.env) {
  return new Set(getLogoutDurationPresets(env));
}

export const DEFAULT_CUSTOM_LOGOUT_DURATION = 60;

/** Shortest preset minutes (Profiles UI). */
export const MIN_LOGOUT_DURATION_PRESET_MINUTES = 15;

export const ADMIN_CUSTOM_LOGOUT_MAX_MINUTES = 525_600;

export function minutesToIdleTimeoutMs(minutes) {
  const m = Math.trunc(Number(minutes));
  if (!Number.isFinite(m) || m < 1) return DEFAULT_CUSTOM_LOGOUT_DURATION * 60 * 1000;
  return m * 60 * 1000;
}

/**
 * @param {unknown} raw
 * @param {{ adminAllowed?: boolean }} [opts]
 * @returns {number | null}
 */
export function normalizeCustomLogoutDuration(raw, { adminAllowed = false, env = process.env } = {}) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  if (adminAllowed) {
    return Math.min(n, ADMIN_CUSTOM_LOGOUT_MAX_MINUTES);
  }
  return buildLogoutDurationPresetSet(env).has(n) ? n : null;
}

/**
 * Cluster-safe resolver: Redis (shared) → JWT claim → Postgres (populate Redis).
 * Use on every authenticated request instead of fetchCustomLogoutDuration.
 */
export async function resolveCustomLogoutMinutes(singlesId, { jwtMinutes } = {}) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return DEFAULT_CUSTOM_LOGOUT_DURATION;

  const fromRedis = await getCachedCustomLogoutMinutes(id);
  if (fromRedis != null) return fromRedis;

  const jwtN = Math.trunc(Number(jwtMinutes));
  if (Number.isFinite(jwtN) && jwtN > 0) {
    void setCachedCustomLogoutMinutes(id, jwtN);
    return jwtN;
  }

  const fromDb = await fetchCustomLogoutDuration(id);
  void setCachedCustomLogoutMinutes(id, fromDb);
  return fromDb;
}

/** Merge resolved logout minutes onto req.auth-style user object. */
export async function withResolvedCustomLogoutMinutes(authUser, decoded) {
  if (!authUser) return null;
  const singlesId = authUser.singles_id ?? decoded?.singles_id;
  const logoutMins = await resolveCustomLogoutMinutes(singlesId, {
    jwtMinutes: decoded?.custom_logout_duration
  });
  return { ...authUser, custom_logout_duration: logoutMins };
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 */
export async function fetchCustomLogoutDuration(singlesId, db = pool) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return DEFAULT_CUSTOM_LOGOUT_DURATION;
  try {
    const { rows } = await db.query(
      `SELECT custom_logout_duration
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [id]
    );
    const n = Math.trunc(Number(rows[0]?.custom_logout_duration));
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CUSTOM_LOGOUT_DURATION;
  } catch {
    return DEFAULT_CUSTOM_LOGOUT_DURATION;
  }
}

/**
 * @param {number[]} singlesIds
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 * @returns {Promise<Map<number, number>>}
 */
export async function fetchCustomLogoutDurationsMap(singlesIds, db = pool) {
  const ids = [...new Set(singlesIds.map((x) => Math.trunc(Number(x))).filter((id) => Number.isFinite(id) && id >= 1))];
  const map = new Map();
  if (!ids.length) return map;

  try {
    const { rows } = await db.query(
      `SELECT singles_id, custom_logout_duration
       FROM helloworldjunktest.singles
       WHERE singles_id = ANY($1::bigint[])`,
      [ids]
    );
    for (const row of rows) {
      const id = Number(row.singles_id);
      const n = Math.trunc(Number(row.custom_logout_duration));
      if (Number.isFinite(id) && id >= 1) {
        map.set(id, Number.isFinite(n) && n > 0 ? n : DEFAULT_CUSTOM_LOGOUT_DURATION);
      }
    }
  } catch {
    // fall through — callers use DEFAULT_CUSTOM_LOGOUT_DURATION
  }

  for (const id of ids) {
    if (!map.has(id)) map.set(id, DEFAULT_CUSTOM_LOGOUT_DURATION);
  }
  return map;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 */
export async function setCustomLogoutDuration(singlesId, minutes, db = pool) {
  const id = Number(singlesId);
  const n = Math.trunc(Number(minutes));
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(n) || n < 1) {
    throw new Error('Invalid singles_id or custom_logout_duration');
  }
  await db.query(
    `UPDATE helloworldjunktest.singles
     SET custom_logout_duration = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $2`,
    [n, id]
  );
  await setCachedCustomLogoutMinutes(id, n);
  await invalidateAuthUserCache(id);
}
