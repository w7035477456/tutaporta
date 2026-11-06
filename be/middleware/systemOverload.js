import {
  SYSTEM_OVERLOADED_CODE,
  SYSTEM_OVERLOADED_MESSAGE
} from '../constants/systemOverload.js';
import { getPgPoolStats } from '../db/connection.js';

function envBool(name, defaultTrue) {
  const raw = String(process.env[name] ?? (defaultTrue ? 'true' : 'false'))
    .trim()
    .toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  return defaultTrue;
}

function envInt(name, fallback) {
  const n = Number(String(process.env[name] ?? '').trim());
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

/** Skip overload gate for probes and static health (HAProxy must not mark backends down). */
function shouldSkipSystemOverload(req) {
  const path = String(req.path || '');
  if (req.method === 'GET' && (path === '/health' || path === '/api/health')) return true;
  if (req.method === 'HEAD') return true;
  return false;
}

export function isSystemOverloadEnabled() {
  return envBool('SYSTEM_OVERLOAD_ENABLED', true);
}

export function readSystemOverloadThresholds() {
  return {
    poolWaiting: envInt('SYSTEM_OVERLOAD_POOL_WAITING', 8),
    busyPct: envInt('SYSTEM_OVERLOAD_BUSY_PCT', 88),
    retryAfterSec: Math.max(5, envInt('SYSTEM_OVERLOAD_RETRY_AFTER_SEC', 15))
  };
}

/**
 * When the local pg pool is saturated, return 503 + Retry-After so the FE can wait and retry
 * instead of hanging until HAProxy/nginx times out.
 */
export function systemOverloadMiddleware(req, res, next) {
  if (shouldSkipSystemOverload(req)) return next();
  // Load-test switch; envConfig re-reads ~/.ssh/be/.env every 10s, so no restart is needed.
  const fakeOverload = envBool('FAKE_LOT_OF_USERS', false);
  if (!fakeOverload && !isSystemOverloadEnabled()) return next();

  const { poolWaiting, busyPct, retryAfterSec } = readSystemOverloadThresholds();
  const stats = getPgPoolStats();
  const saturated =
    fakeOverload ||
    stats.waitingCount >= poolWaiting ||
    (busyPct > 0 && stats.busyPct >= busyPct);

  if (!saturated) return next();

  res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(503).json({
    code: SYSTEM_OVERLOADED_CODE,
    error: SYSTEM_OVERLOADED_MESSAGE,
    retryAfterSeconds: retryAfterSec
  });
}
