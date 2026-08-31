import { getAuthTokenFromCookies } from '../utils/authCookie.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Pre-auth flows must work even when a stale session cookie is still present. */
function isTrustedOriginExemptApiPath(path) {
  const p = String(path || '');
  if (p.startsWith('/api/mobilePhotoUpload/')) return true;
  return TRUSTED_ORIGIN_EXEMPT_API_PATHS.has(p);
}

const TRUSTED_ORIGIN_EXEMPT_API_PATHS = new Set([
  '/api/verifyPassword',
  '/api/register',
  '/api/verifyRegistrationCode',
  '/api/requestPasswordReset',
  '/api/completePasswordReset',
  '/api/createPassword',
  '/api/verifyPhone',
  '/api/cleanupVerificationsByEmail',
  '/api/resendPhoneCode',
  '/api/sendRegistrationSms',
  '/api/signup/bypass-sms-phone-verification',
  '/api/auth/google/signup/complete',
  '/api/completeEmailChange',
  '/api/supportMessage',
  '/api/logout',
  '/api/admin/impersonate',
  '/api/mobilePhotoUpload/photo'
]);

function parseAllowedOriginPatterns() {
  const raw = String(process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith('regex:')) {
        const source = entry.slice('regex:'.length).trim();
        try {
          return new RegExp(source);
        } catch {
          console.warn('[security] Ignoring invalid ALLOWED_ORIGINS regex:', source);
          return null;
        }
      }
      return entry;
    })
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedOriginPatterns) {
  if (!origin) return false;
  return allowedOriginPatterns.some((entry) => {
    if (typeof entry === 'string') return entry === origin;
    return entry.test(origin);
  });
}

function normalizeOrigin(urlLike) {
  if (!urlLike) return '';
  try {
    return new URL(urlLike).origin;
  } catch {
    return '';
  }
}

/**
 * CSRF defense for cookie-authenticated mutating API requests.
 * Requires Origin/Referer to match CORS allowlist.
 */
export function requireTrustedOriginFactory(allowedOriginPatterns) {
  return function requireTrustedOrigin(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    if (isTrustedOriginExemptApiPath(req.path)) return next();

    const hasSessionCookie = Boolean(getAuthTokenFromCookies(req.cookies));
    if (!hasSessionCookie) return next();

    const origin = String(req.get('origin') || '').trim();
    const refererOrigin = normalizeOrigin(String(req.get('referer') || '').trim());
    const directMatch = isOriginAllowed(origin, allowedOriginPatterns);
    const refererMatch = isOriginAllowed(refererOrigin, allowedOriginPatterns);

    if (directMatch || refererMatch) return next();

    const detail = {
      method: req.method,
      path: req.originalUrl || req.path,
      origin: origin || null,
      referer: String(req.get('referer') || '').trim() || null,
      refererOrigin: refererOrigin || null,
      host: String(req.get('host') || '').trim() || null,
      allowedOriginPatterns: allowedOriginPatterns.map((entry) =>
        typeof entry === 'string' ? entry : `regex:${entry.source}`
      ),
      hasTokenCookie: Boolean(getAuthTokenFromCookies(req.cookies))
    };
    console.warn(`[403][requireTrustedOrigin] ${JSON.stringify(detail)}`);

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Blocked by CSRF origin policy'
    });
  };
}

export { parseAllowedOriginPatterns, isOriginAllowed };
