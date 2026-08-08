import crypto from 'crypto';
import { appLog } from '../logger.js';
import { DEFAULT_CUSTOM_LOGOUT_DURATION } from './customLogoutDuration.js';
import { parseLogoutWarnSeconds } from './sessionTimeoutConfig.js';

/** One active login per member — cluster-wide via centralized Redis. */
export const SESSION_KEY_PREFIX = 'v1:session:';

let redisClient = null;

export function setSingleLoginRedis(client) {
  redisClient = client || null;
}

export function getSingleLoginRedis() {
  return redisClient;
}

export function isSingleLoginRedisAvailable() {
  return Boolean(redisClient);
}

export function sessionRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${SESSION_KEY_PREFIX}${id}`;
}

export function newSessionId() {
  return crypto.randomUUID();
}

/** Idle window + warning popup — stale keys expire when the browser is closed or Mac sleeps. */
export function logoutMinutesToSessionTtlSeconds(minutes) {
  const mins = Math.trunc(Number(minutes));
  const effective =
    Number.isFinite(mins) && mins > 0 ? mins : DEFAULT_CUSTOM_LOGOUT_DURATION;
  const warnSec = parseLogoutWarnSeconds();
  return Math.max(900, effective * 60 + warnSec);
}

/**
 * Register a new login (overwrites prior device). Returns session_id for JWT, or null when Redis unavailable.
 * @param {number} singlesId
 * @param {number} [logoutMinutes] — from resolveCustomLogoutMinutes at login (avoids Postgres on cluster).
 * @returns {Promise<string|null>}
 */
export async function startSingleLoginSession(singlesId, logoutMinutes) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;

  const sessionId = newSessionId();
  if (!redisClient) {
    appLog.warn('[singleLogin] Redis unavailable — JWT-only session (single-login disabled)');
    return null;
  }

  try {
    const ttl = logoutMinutesToSessionTtlSeconds(logoutMinutes);
    await redisClient.set(sessionRedisKey(id), sessionId, 'EX', ttl);
    return sessionId;
  } catch (err) {
    appLog.warn('[singleLogin] start failed', { singles_id: id, message: err?.message ?? err });
    return null;
  }
}

/** End session when JWT session_id still matches (logout). */
export async function endSingleLoginSessionIfMatches(singlesId, jwtSessionId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1 || !redisClient) return false;

  const jwtSid = String(jwtSessionId ?? '').trim();
  if (!jwtSid) return false;

  const key = sessionRedisKey(id);
  try {
    const current = String((await redisClient.get(key)) ?? '').trim();
    if (!current || current !== jwtSid) return false;
    await redisClient.del(key);
    return true;
  } catch (err) {
    appLog.warn('[singleLogin] end-if-matches failed', { singles_id: id, message: err?.message ?? err });
    return false;
  }
}

/**
 * Validate JWT session_id against Redis (single device). When Redis is down, degrade to JWT-only.
 * @param {number} singlesId
 * @param {string|undefined} jwtSessionId
 * @param {{ logoutMinutes?: number, cachedLogoutMinutes?: number }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, code: 'sessionSuperseded' | 'sessionExpired', customLogoutDuration?: number }>}
 */
export async function validateSingleLoginSession(
  singlesId,
  jwtSessionId,
  { logoutMinutes, cachedLogoutMinutes } = {}
) {
  const id = Number(singlesId);
  const fallbackMinutes = DEFAULT_CUSTOM_LOGOUT_DURATION;
  const resolvedMinutesRaw = logoutMinutes ?? cachedLogoutMinutes;
  const resolvedMinutes = Math.trunc(Number(resolvedMinutesRaw));
  const mins =
    Number.isFinite(resolvedMinutes) && resolvedMinutes > 0
      ? resolvedMinutes
      : fallbackMinutes;

  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, code: 'sessionExpired', customLogoutDuration: fallbackMinutes };
  }

  if (!redisClient) {
    return { ok: true };
  }

  const jwtSid = String(jwtSessionId ?? '').trim();
  if (!jwtSid) {
    return { ok: true };
  }

  try {
    const current = String((await redisClient.get(sessionRedisKey(id))) ?? '').trim();

    if (!current) {
      return { ok: false, code: 'sessionExpired', customLogoutDuration: mins };
    }
    if (jwtSid !== current) {
      return { ok: false, code: 'sessionSuperseded' };
    }

    const ttl = logoutMinutesToSessionTtlSeconds(mins);
    await redisClient.expire(sessionRedisKey(id), ttl);

    return { ok: true };
  } catch (err) {
    appLog.warn('[singleLogin] validate failed — degrading to JWT-only', {
      singles_id: id,
      message: err?.message ?? err
    });
    return { ok: true };
  }
}
