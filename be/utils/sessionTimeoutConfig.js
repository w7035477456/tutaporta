import { parseLogoutAutoMinutes, resolveCustomLogoutMinutes } from './customLogoutDuration.js';

/**
 * FE idle logout: header main countdown = custom_logout_duration (minutes → seconds),
 * then LOGOUT_WARN_MIN / LOGOUT_WARN_SEC modal before sign-out.
 * Backend single-login: Redis session_id check only (see singleLoginSession.js).
 */

/** Warning popup duration in seconds — LOGOUT_WARN_MIN (minutes) or LOGOUT_WARN_SEC fallback. */
export function parseLogoutWarnSeconds(env = process.env) {
  const rawMin = String(env.LOGOUT_WARN_MIN ?? '').trim();
  const parsedMin = parseInt(rawMin, 10);
  if (Number.isFinite(parsedMin) && parsedMin > 0) {
    return parsedMin * 60;
  }
  const rawSec = String(env.LOGOUT_WARN_SEC ?? '').trim();
  const parsedSec = parseInt(rawSec, 10);
  return Number.isFinite(parsedSec) && parsedSec > 0 ? parsedSec : 10;
}

export async function buildSessionConfigResponse({ singlesId, jwtMinutes } = {}) {
  const logoutWarnSeconds = parseLogoutWarnSeconds();
  const logoutAutoMinMinutes = parseLogoutAutoMinutes();
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return {
      sessionTimeoutEnabled: false,
      logoutAfterMinutes: null,
      logoutMainSeconds: null,
      logoutWarnSeconds,
      logoutAutoMinMinutes
    };
  }

  const logoutAfterMinutes = await resolveCustomLogoutMinutes(id, { jwtMinutes });
  return {
    sessionTimeoutEnabled: logoutAfterMinutes > 0,
    logoutAfterMinutes,
    logoutMainSeconds: logoutAfterMinutes * 60,
    logoutWarnSeconds,
    logoutAutoMinMinutes
  };
}
