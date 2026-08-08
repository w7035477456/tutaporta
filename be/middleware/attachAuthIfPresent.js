import { resolveSessionAuth } from '../utils/resolveSessionAuth.js';

/**
 * Sets req.auth when a valid session cookie is present; does not reject when missing.
 */
export async function attachAuthIfPresent(req, res, next) {
  const session = await resolveSessionAuth(req);
  if (session) req.auth = session;
  next();
}
