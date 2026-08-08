import jwt from 'jsonwebtoken';
import { resolveAuthUserFromJwt } from './adminAuth.js';
import { getPublicKey } from '../jwtKeys.js';
import { getAuthTokenFromCookies } from './authCookie.js';
import { withResolvedCustomLogoutMinutes } from './customLogoutDuration.js';

/**
 * Resolve logged-in member from JWT cookie (same rules as /api/me + requireAuth).
 * @returns {{ singles_id: number, email: string, role: string } | null}
 */
export async function resolveSessionAuth(req) {
  const token = getAuthTokenFromCookies(req.cookies);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
    return await withResolvedCustomLogoutMinutes(await resolveAuthUserFromJwt(decoded), decoded);
  } catch {
    return null;
  }
}

export function getReqSinglesId(req) {
  const raw = req.auth?.singles_id ?? req.auth?.singlesId;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : null;
}
