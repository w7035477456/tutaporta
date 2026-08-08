import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getClientApiRateLimitConfig } from 'config/clientApiRateLimitEnv';
import { isClientApiRateLimitBypassed } from 'utils/adminSession';

const STORAGE_KEY = 'clientApiCooldown:v1';
const FETCH_PATCH_FLAG = '__clientApiCooldownFetchPatched';
const RATE_LIMIT_EVENT = 'rateLimit429';

export class ClientApiCooldownError extends Error {
  constructor(cooldownUntil) {
    const seconds = Math.max(0, Math.ceil((Number(cooldownUntil) - Date.now()) / 1000));
    super(`Client API cooldown active. Please wait ${seconds} seconds.`);
    this.name = 'ClientApiCooldownError';
    this.cooldownUntil = cooldownUntil;
    this.status = 429;
    this.clientCooldown = true;
  }
}

function nowMs() {
  return Date.now();
}

function logClientApiRateLimit(config, info) {
  if (!config?.consoleLog || typeof window === 'undefined') return;
  const used = Number(info?.used) || 0;
  const limit = Math.max(1, Number(info?.limit) || 1);
  const left = Math.max(0, limit - used);
  const percentLeft = Math.max(0, Math.min(100, (left / limit) * 100));
  const cooldownRemaining = Math.max(0, Number(info?.cooldownRemainingSeconds) || 0);
  const endpoint = String(info?.endpoint || '');
  const phase = String(info?.phase || 'pass');
  console.info(
    `[client-rate-limit] ${phase} endpoint=${endpoint} used=${used}/${limit} left=${left} (${percentLeft.toFixed(1)}%) cooldown_remaining=${cooldownRemaining}s window=${config.timesliceSeconds}s cooldown=${config.cooldownSeconds}s`
  );
}

function readState() {
  if (typeof window === 'undefined') return { timestamps: [], cooldownUntil: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps.map(Number).filter(Number.isFinite) : [],
      cooldownUntil: Number(parsed.cooldownUntil) || 0
    };
  } catch {
    return { timestamps: [], cooldownUntil: 0 };
  }
}

function writeState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamps: Array.isArray(state.timestamps) ? state.timestamps : [],
        cooldownUntil: Number(state.cooldownUntil) || 0
      })
    );
  } catch {
    // If localStorage is unavailable, skip persistence rather than blocking normal API use.
  }
}

function notifyClientCooldown(cooldownUntil, config) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RATE_LIMIT_EVENT, {
      detail: {
        source: 'clientApiCooldown',
        cooldownUntil,
        cooldownSeconds: config.cooldownSeconds
      }
    })
  );
}

function toUrl(input, base) {
  const raw = typeof input === 'string' ? input : input?.url;
  if (!raw || typeof window === 'undefined') return null;
  try {
    return new URL(raw, base || window.location.href);
  } catch {
    return null;
  }
}

export function isBackendApiRequest(input, base) {
  if (typeof window === 'undefined') return false;
  const url = toUrl(input, base);
  if (!url) return false;

  const apiBase = new URL(getApiBaseUrl(), window.location.href);
  const sameApiOrigin = url.origin === apiBase.origin;
  const sameWindowOrigin = url.origin === window.location.origin;
  const isApiPath = url.pathname === '/api' || url.pathname.startsWith('/api/');
  const apiBasePath = apiBase.pathname.replace(/\/$/, '');
  const isApiBasePath = apiBasePath && (url.pathname === apiBasePath || url.pathname.startsWith(`${apiBasePath}/api/`));

  if (url.pathname === '/api/rateLimitStatus') return false;
  return (sameApiOrigin && (isApiPath || isApiBasePath)) || (sameWindowOrigin && isApiPath);
}

export function clearClientApiCooldownState() {
  writeState({ timestamps: [], cooldownUntil: 0 });
}

export function enforceClientApiCooldown(input, { base } = {}) {
  if (typeof window === 'undefined') return;
  if (isClientApiRateLimitBypassed()) return;
  const config = getClientApiRateLimitConfig();
  if (!config.enabled || config.accessLimit < 1) return;
  if (!isBackendApiRequest(input, base)) return;
  const endpoint = toUrl(input, base)?.pathname || String(input ?? '');

  const now = nowMs();
  const windowMs = config.timesliceSeconds * 1000;
  const cooldownMs = config.cooldownSeconds * 1000;
  const state = readState();
  const activeTimestamps = state.timestamps.filter((ts) => now - ts < windowMs);

  if (state.cooldownUntil > now) {
    logClientApiRateLimit(config, {
      phase: 'blocked-cooldown',
      endpoint,
      used: activeTimestamps.length,
      limit: config.accessLimit,
      cooldownRemainingSeconds: Math.ceil((state.cooldownUntil - now) / 1000)
    });
    notifyClientCooldown(state.cooldownUntil, config);
    throw new ClientApiCooldownError(state.cooldownUntil);
  }

  const timestamps = activeTimestamps;
  if (timestamps.length >= config.accessLimit) {
    const cooldownUntil = now + cooldownMs;
    writeState({ timestamps, cooldownUntil });
    logClientApiRateLimit(config, {
      phase: 'triggered-cooldown',
      endpoint,
      used: timestamps.length,
      limit: config.accessLimit,
      cooldownRemainingSeconds: Math.ceil(cooldownMs / 1000)
    });
    notifyClientCooldown(cooldownUntil, config);
    throw new ClientApiCooldownError(cooldownUntil);
  }

  timestamps.push(now);
  writeState({ timestamps, cooldownUntil: 0 });
  logClientApiRateLimit(config, {
    phase: 'pass',
    endpoint,
    used: timestamps.length,
    limit: config.accessLimit,
    cooldownRemainingSeconds: 0
  });
}

export function getClientApiCooldownRemainingSeconds(cooldownUntil) {
  return Math.max(0, Math.ceil((Number(cooldownUntil) - nowMs()) / 1000));
}

export function installClientApiCooldownFetchGuard() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if (window[FETCH_PATCH_FLAG]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      enforceClientApiCooldown(input);
    } catch (error) {
      return Promise.reject(error);
    }
    return originalFetch(input, init);
  };
  window[FETCH_PATCH_FLAG] = true;
}
