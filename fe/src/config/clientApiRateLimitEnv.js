function readPositiveNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readEnabled(value, fallback = true) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') return true;
  return fallback;
}

/** Prefer FE_RATE_CLIENT_API_* from ~/.ssh/be/.env (mirrored in vite.config.mjs); legacy RATE_CLIENT_API_* still read if set. */
function readFeRateEnv(name) {
  const feKey = `FE_RATE_CLIENT_API_${name}`;
  const legacyKey = `RATE_CLIENT_API_${name}`;
  const feVal = import.meta.env[feKey];
  const legacyVal = import.meta.env[legacyKey];
  if (feVal !== undefined && feVal !== '') return feVal;
  return legacyVal;
}

/** Master switch: FE_RATE_LIMIT_ENABLE=false disables all browser API rate limiting (~/.ssh/be/.env). */
export function isFrontendRateLimitEnabled() {
  return readEnabled(import.meta.env.FE_RATE_LIMIT_ENABLE, true);
}

/** Browser-only API gate — config from ~/.ssh/be/.env, mirrored at Vite build/dev startup. */
export function getClientApiRateLimitConfig() {
  const masterEnabled = isFrontendRateLimitEnabled();
  const cooldownEnabled = readEnabled(readFeRateEnv('COOLDOWN_ENABLED'), true);
  return {
    enabled: masterEnabled && cooldownEnabled,
    accessLimit: Math.floor(readPositiveNumber(readFeRateEnv('ACCESS_LIMIT'), 120)),
    timesliceSeconds: readPositiveNumber(readFeRateEnv('TIMESLICE_SECONDS'), 60),
    cooldownSeconds: readPositiveNumber(readFeRateEnv('COOLDOWN_SECONDS'), 30),
    consoleLog: masterEnabled && readEnabled(readFeRateEnv('CONSOLE_LOG'), false)
  };
}
