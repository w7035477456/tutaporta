import { getSingleLoginRedis } from './singleLoginSession.js';

/** Cluster-wide cache — shared Redis (same REDIS_URL as single-login sessions). */
export const LOGOUT_MINS_KEY_PREFIX = 'v1:logout_mins:';

/** Longer than max "keep me logged in" JWT age; refreshed on login / settings save / DB read. */
const CACHE_TTL_SEC = 35 * 24 * 3600;

export function logoutMinutesRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${LOGOUT_MINS_KEY_PREFIX}${id}`;
}

/** @returns {Promise<number|null>} */
export async function getCachedCustomLogoutMinutes(singlesId) {
  const redis = getSingleLoginRedis();
  if (!redis) return null;
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return null;
  try {
    const raw = await redis.get(logoutMinutesRedisKey(id));
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function setCachedCustomLogoutMinutes(singlesId, minutes) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  const n = Math.trunc(Number(minutes));
  if (!redis || !Number.isFinite(id) || id < 1 || !Number.isFinite(n) || n < 1) return;
  try {
    await redis.set(logoutMinutesRedisKey(id), String(n), 'EX', CACHE_TTL_SEC);
  } catch {
    // Redis down — JWT / Postgres still work
  }
}

export async function invalidateCachedCustomLogoutMinutes(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.del(logoutMinutesRedisKey(id));
  } catch {
    // ignore
  }
}
