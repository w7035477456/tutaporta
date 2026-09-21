import crypto from 'crypto';
import { appLog } from '../logger.js';
import { DEFAULT_CUSTOM_LOGOUT_DURATION } from './customLogoutDuration.js';
import {
  LOGIN_SESSION_DEVICE_DESKTOP,
  LOGIN_SESSION_DEVICE_MOBILE,
  normalizeLoginSessionDeviceClass
} from './loginSessionDeviceClass.js';
import { parseLogoutWarnSeconds } from './sessionTimeoutConfig.js';

/** One active login per member per device class — cluster-wide via centralized Redis. */
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

/** Legacy single key (pre mobile+desktop split). */
export function sessionRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${SESSION_KEY_PREFIX}${id}`;
}

/** Device-specific slot: v1:session:{singlesId}:mobile | :desktop */
export function sessionRedisKeyForDevice(singlesId, deviceClass) {
  const id = Math.trunc(Number(singlesId));
  const slot = normalizeLoginSessionDeviceClass(deviceClass);
  if (!slot) return sessionRedisKey(id);
  return `${SESSION_KEY_PREFIX}${id}:${slot}`;
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
 * Register a new login for this device class (overwrites prior session on same class only).
 * Returns session_id for JWT, or null when Redis unavailable.
 * @param {number} singlesId
 * @param {number} [logoutMinutes]
 * @param {'mobile'|'desktop'} [deviceClass]
 * @returns {Promise<string|null>}
 */
export async function startSingleLoginSession(
  singlesId,
  logoutMinutes,
  deviceClass = LOGIN_SESSION_DEVICE_DESKTOP
) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;

  const slot = normalizeLoginSessionDeviceClass(deviceClass) || LOGIN_SESSION_DEVICE_DESKTOP;
  const sessionId = newSessionId();
  if (!redisClient) {
    appLog.warn('[singleLogin] Redis unavailable — JWT-only session (single-login disabled)');
    return null;
  }

  try {
    const ttl = logoutMinutesToSessionTtlSeconds(logoutMinutes);
    const key = sessionRedisKeyForDevice(id, slot);
    await redisClient.set(key, sessionId, 'EX', ttl);
    // Retire pre-split single key so at most one mobile + one desktop remain.
    await redisClient.del(sessionRedisKey(id));
    return sessionId;
  } catch (err) {
    appLog.warn('[singleLogin] start failed', { singles_id: id, message: err?.message ?? err });
    return null;
  }
}

/** End session when JWT session_id still matches (logout). */
export async function endSingleLoginSessionIfMatches(singlesId, jwtSessionId, deviceClass) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1 || !redisClient) return false;

  const jwtSid = String(jwtSessionId ?? '').trim();
  if (!jwtSid) return false;

  const slot = normalizeLoginSessionDeviceClass(deviceClass);
  const keys = slot
    ? [sessionRedisKeyForDevice(id, slot)]
    : [sessionRedisKey(id), sessionRedisKeyForDevice(id, LOGIN_SESSION_DEVICE_MOBILE), sessionRedisKeyForDevice(id, LOGIN_SESSION_DEVICE_DESKTOP)];

  try {
    for (const key of keys) {
      const current = String((await redisClient.get(key)) ?? '').trim();
      if (!current || current !== jwtSid) continue;
      await redisClient.del(key);
      return true;
    }
    return false;
  } catch (err) {
    appLog.warn('[singleLogin] end-if-matches failed', { singles_id: id, message: err?.message ?? err });
    return false;
  }
}

/**
 * Keys a JWT may match. With a device class: only that slot, so a mobile login never
 * supersedes desktop (and vice versa). JWTs issued before the split carry no class —
 * accept any slot so those tabs are not logged out on deploy.
 */
function redisKeysToValidate(id, jwtDeviceClass) {
  const slot = normalizeLoginSessionDeviceClass(jwtDeviceClass);
  if (slot) {
    return [sessionRedisKeyForDevice(id, slot)];
  }
  return [
    sessionRedisKey(id),
    sessionRedisKeyForDevice(id, LOGIN_SESSION_DEVICE_MOBILE),
    sessionRedisKeyForDevice(id, LOGIN_SESSION_DEVICE_DESKTOP)
  ];
}

/**
 * Validate JWT session_id against Redis (one mobile + one desktop max).
 * When Redis is down, degrade to JWT-only.
 * @param {number} singlesId
 * @param {string|undefined} jwtSessionId
 * @param {{ logoutMinutes?: number, cachedLogoutMinutes?: number, deviceClass?: string|null }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, code: 'sessionSuperseded' | 'sessionExpired', customLogoutDuration?: number }>}
 */
export async function validateSingleLoginSession(
  singlesId,
  jwtSessionId,
  { logoutMinutes, cachedLogoutMinutes, deviceClass } = {}
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

  const slot = normalizeLoginSessionDeviceClass(deviceClass);

  try {
    const keys = redisKeysToValidate(id, slot);
    const ttl = logoutMinutesToSessionTtlSeconds(mins);
    let anySlotOccupied = false;

    for (const key of keys) {
      const current = String((await redisClient.get(key)) ?? '').trim();
      if (!current) continue;
      anySlotOccupied = true;
      if (current !== jwtSid) continue;
      await redisClient.expire(key, ttl);
      return { ok: true };
    }

    // Slot taken by a newer login on this same device class → superseded; empty → idle expiry.
    if (anySlotOccupied) {
      return { ok: false, code: 'sessionSuperseded' };
    }
    return { ok: false, code: 'sessionExpired', customLogoutDuration: mins };
  } catch (err) {
    appLog.warn('[singleLogin] validate failed — degrading to JWT-only', {
      singles_id: id,
      message: err?.message ?? err
    });
    return { ok: true };
  }
}
