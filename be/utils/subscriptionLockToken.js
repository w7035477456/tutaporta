/**
 * Short-lived unlock token for the Locked Subscription table.
 * Stateless (works across the round-robin cluster): HMAC-SHA256 over {sid, exp} keyed from the
 * server JWT private key. It is NOT a login JWT, so requireAuth never accepts it.
 * Sent by the client in the X-Subscription-Unlock header.
 */
import crypto from 'crypto';
import { getPrivateKey } from '../jwtKeys.js';

export const SUBSCRIPTION_UNLOCK_HEADER = 'x-subscription-unlock';
/** Unlocked table stays usable this long; then the user enters the password again. */
export const SUBSCRIPTION_UNLOCK_TTL_MS = 30 * 60 * 1000;

function hmacKey() {
  const base = getPrivateKey();
  const text = typeof base === 'string' || Buffer.isBuffer(base) ? base : String(base?.export?.({ type: 'pkcs8', format: 'pem' }) ?? '');
  return crypto.createHash('sha256').update('locked-subscription-v1:').update(text).digest();
}

function sign(body) {
  return crypto.createHmac('sha256', hmacKey()).update(body).digest('base64url');
}

export function issueSubscriptionUnlockToken(singlesId, now = Date.now()) {
  const exp = now + SUBSCRIPTION_UNLOCK_TTL_MS;
  const body = Buffer.from(JSON.stringify({ sid: Number(singlesId), exp })).toString('base64url');
  return { token: `${body}.${sign(body)}`, expiresAt: new Date(exp).toISOString() };
}

/** True when the token is genuine, unexpired, and belongs to singlesId. */
export function verifySubscriptionUnlockToken(token, singlesId, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return false;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { sid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Number(sid) === Number(singlesId) && Number(exp) > now;
  } catch {
    return false;
  }
}

/** Throws 403 (code SUBSCRIPTION_LOCKED) unless the request carries a valid unlock token. */
export function requireSubscriptionUnlock(req, singlesId) {
  if (verifySubscriptionUnlockToken(req.get?.(SUBSCRIPTION_UNLOCK_HEADER), singlesId)) return;
  const err = new Error('Locked Subscription is locked — click Locked Subscription and enter your password.');
  err.statusCode = 403;
  err.code = 'SUBSCRIPTION_LOCKED';
  throw err;
}
