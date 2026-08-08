import pool from '../db/connection.js';
import { getSingleLoginRedis } from './singleLoginSession.js';

/** Cluster-wide cache — shared Redis (same REDIS_URL as single-login sessions). */
export const AUTH_USER_KEY_PREFIX = 'v1:auth_user:';

/** Short TTL safety net; invalidate on vault/email/logout/delete writes. */
const CACHE_TTL_SEC = 30;

export function authUserRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${AUTH_USER_KEY_PREFIX}${id}`;
}

function buildAuthUserRow(row, jwtClaims) {
  const role = String(jwtClaims?.role ?? '').trim() === 'Admin' ? 'Admin' : 'user';
  const impersonatedRaw = jwtClaims?.impersonated_by_admin_id;
  const impersonatedByAdminId =
    impersonatedRaw == null
      ? null
      : Number.isFinite(Number(impersonatedRaw))
        ? Math.trunc(Number(impersonatedRaw))
        : null;
  const logoutMinutes = Math.trunc(Number(jwtClaims?.custom_logout_duration));
  const customLogoutDuration =
    Number.isFinite(logoutMinutes) && logoutMinutes > 0 ? logoutMinutes : null;

  return {
    singles_id: row.singles_id,
    email: row.email,
    role,
    impersonated_by_admin_id: role === 'Admin' ? impersonatedByAdminId : null,
    custom_logout_duration: customLogoutDuration,
    notes_access_password_enabled: Boolean(row?.notes_access_password_enabled)
  };
}

function parseCachedAuthUserRow(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const id = Math.trunc(Number(parsed?.singles_id));
    if (!Number.isFinite(id) || id < 1) return null;
    return {
      singles_id: id,
      email: parsed.email ?? null,
      notes_access_password_enabled: Boolean(parsed.notes_access_password_enabled)
    };
  } catch {
    return null;
  }
}

async function getCachedAuthUserRow(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return null;
  try {
    const raw = await redis.get(authUserRedisKey(id));
    return parseCachedAuthUserRow(raw);
  } catch {
    return null;
  }
}

async function setCachedAuthUserRow(singlesId, row) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1 || !row) return;
  try {
    await redis.set(
      authUserRedisKey(id),
      JSON.stringify({
        singles_id: row.singles_id,
        email: row.email ?? null,
        notes_access_password_enabled: Boolean(row.notes_access_password_enabled)
      }),
      'EX',
      CACHE_TTL_SEC
    );
  } catch {
    // Redis down — Postgres remains source of truth
  }
}

async function fetchAuthUserFromDb(singlesId, fallbackEmail) {
  const result = await pool.query(
    `SELECT singles_id,
            email,
            notes_access_password_enabled
       FROM helloworldjunktest.singles
      WHERE singles_id = $1`,
    [singlesId]
  );
  if (!result.rows.length) return null;

  const row = result.rows[0];
  const id = Number(row.singles_id);
  if (!Number.isFinite(id) || id < 1) return null;

  return {
    singles_id: id,
    email: row.email ?? fallbackEmail ?? null,
    notes_access_password_enabled: row.notes_access_password_enabled
  };
}

export async function invalidateAuthUserCache(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.del(authUserRedisKey(id));
  } catch {
    // ignore
  }
}

/**
 * Resolve { singles_id, email, role, notes_access_password_enabled } for a verified JWT payload.
 * Cluster-wide Redis cache (30s TTL) — invalidate via invalidateAuthUserCache().
 */
export async function lookupAuthUserBySinglesId(singlesId, { fallbackEmail, jwtClaims } = {}) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const key = Math.trunc(id);

  const cached = await getCachedAuthUserRow(key);
  if (cached) {
    return buildAuthUserRow(cached, jwtClaims);
  }

  const dbRow = await fetchAuthUserFromDb(key, fallbackEmail);
  if (!dbRow) {
    await invalidateAuthUserCache(key);
    return null;
  }

  await setCachedAuthUserRow(key, dbRow);
  return buildAuthUserRow(dbRow, jwtClaims);
}
