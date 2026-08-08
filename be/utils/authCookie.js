const LEGACY_AUTH_COOKIE_NAME = 'token';
/** Default session when "Keep me logged in" is unchecked. */
export const AUTH_SESSION_MAX_AGE_MS = 60 * 60 * 1000;
/** Default persistent session when KEEP_ME_LOGIN / AUTH_REMEMBER_MAX_AGE_MS unset (30 days). */
export const AUTH_REMEMBER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function readSameSite() {
  const raw = String(process.env.AUTH_COOKIE_SAMESITE || 'strict').trim().toLowerCase();
  if (raw === 'strict') return 'strict';
  if (raw === 'none') return 'none';
  return 'strict';
}

function readSecureEnvFlag() {
  const raw = String(process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return null;
}

/** True when the inbound request is HTTPS (direct TLS or HAProxy X-Forwarded-Proto). */
export function isRequestSecure(req) {
  if (!req) return false;
  if (req.secure === true) return true;
  const forwarded = String(req.headers?.['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return forwarded === 'https';
}

function resolveSecureCookie({ requestSecure = false } = {}) {
  const sameSite = readSameSite();
  if (sameSite === 'none') return true;
  if (isProduction()) return true;
  const envFlag = readSecureEnvFlag();
  if (envFlag === true) return true;
  if (envFlag === false) return false;
  return Boolean(requestSecure);
}

function readPositiveIntMs(raw, fallback) {
  const n = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(n) || n < 60 * 1000) return fallback;
  return n;
}

/** Days for "Keep me logged in" — ~/.ssh/be/.env KEEP_ME_LOGIN (default 30). */
export function getKeepMeLoginDays() {
  const raw = String(process.env.KEEP_ME_LOGIN ?? '').trim();
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 365);
  return 30;
}

export function getAuthSessionMaxAgeMs() {
  return readPositiveIntMs(process.env.AUTH_SESSION_MAX_AGE_MS, AUTH_SESSION_MAX_AGE_MS);
}

export function getAuthRememberMaxAgeMs() {
  const keepMeLoginRaw = String(process.env.KEEP_ME_LOGIN ?? '').trim();
  if (keepMeLoginRaw) {
    return getKeepMeLoginDays() * 24 * 60 * 60 * 1000;
  }
  return readPositiveIntMs(process.env.AUTH_REMEMBER_MAX_AGE_MS, AUTH_REMEMBER_MAX_AGE_MS);
}

/**
 * Keep JWT and cookie max-age aligned.
 * jwt.sign accepts expiresIn as seconds number.
 */
export function getAuthJwtExpiresInSeconds({ rememberMe = false } = {}) {
  const ms = rememberMe ? getAuthRememberMaxAgeMs() : getAuthSessionMaxAgeMs();
  return Math.max(60, Math.floor(ms / 1000));
}

/**
 * Cookie name for Set-Cookie. Uses __Host- prefix when Secure (production / HTTPS / env).
 * __Host- requires Secure, Path=/, and no Domain attribute.
 */
export function getAuthCookieName({ secure = false } = {}) {
  const explicit = String(process.env.AUTH_COOKIE_NAME ?? '').trim();
  if (explicit) return explicit;
  if (secure) return `__Host-${LEGACY_AUTH_COOKIE_NAME}`;
  return LEGACY_AUTH_COOKIE_NAME;
}

/** Read JWT from Cookie header object (supports legacy `token` during migration). */
export function getAuthTokenFromCookies(cookies) {
  if (!cookies || typeof cookies !== 'object') return '';
  const primary = getAuthCookieName({ secure: true });
  const legacy = LEGACY_AUTH_COOKIE_NAME;
  const fromPrimary = String(cookies[primary] ?? '').trim();
  if (fromPrimary) return fromPrimary;
  if (primary !== legacy) {
    const fromLegacy = String(cookies[legacy] ?? '').trim();
    if (fromLegacy) return fromLegacy;
  }
  return '';
}

/**
 * @param {{ rememberMe?: boolean, requestSecure?: boolean }} [opts]
 */
export function authCookieOptions({ rememberMe = false, requestSecure = false } = {}) {
  const sameSite = readSameSite();
  const secure = resolveSecureCookie({ requestSecure });
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: rememberMe ? getAuthRememberMaxAgeMs() : getAuthSessionMaxAgeMs(),
    path: '/'
  };
}

export function clearAuthCookieOptions({ requestSecure = false } = {}) {
  const { maxAge, ...options } = authCookieOptions({ requestSecure });
  return options;
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 * @param {{ rememberMe?: boolean }} [opts]
 */
export function setAuthCookie(res, token, { rememberMe = false } = {}) {
  const requestSecure = isRequestSecure(res.req);
  const options = authCookieOptions({ rememberMe, requestSecure });
  const name = getAuthCookieName({ secure: options.secure });
  res.cookie(name, token, options);
  if (name !== LEGACY_AUTH_COOKIE_NAME) {
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, { ...options, maxAge: undefined });
  }
}

export function clearAuthCookie(res) {
  const requestSecure = isRequestSecure(res.req);
  const options = clearAuthCookieOptions({ requestSecure });
  const secureName = getAuthCookieName({ secure: true });
  const insecureName = getAuthCookieName({ secure: false });
  res.clearCookie(secureName, options);
  if (insecureName !== secureName) {
    res.clearCookie(insecureName, options);
  }
  if (secureName !== LEGACY_AUTH_COOKIE_NAME && insecureName !== LEGACY_AUTH_COOKIE_NAME) {
    res.clearCookie(LEGACY_AUTH_COOKIE_NAME, options);
  }
}

/** @deprecated use getAuthCookieName() — kept for imports expecting constant legacy name */
export const AUTH_COOKIE_NAME = LEGACY_AUTH_COOKIE_NAME;
