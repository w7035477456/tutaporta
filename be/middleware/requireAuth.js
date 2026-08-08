import jwt from 'jsonwebtoken';
import { logImpersonatedMutation, resolveAuthUserFromJwt, isToolsOnlyAdminJwt } from '../utils/adminAuth.js';
import { enforceSingleLoginSession } from './enforceSingleLogin.js';
import { getPublicKey } from '../jwtKeys.js';
import { getAuthTokenFromCookies } from '../utils/authCookie.js';
import { respondSessionInvalid } from '../utils/sessionInvalidResponse.js';
import { lookupSystemToolsAdminSingles } from '../utils/systemToolsAdmin.js';
import { withResolvedCustomLogoutMinutes } from '../utils/customLogoutDuration.js';
import pool from '../db/connection.js';

/**
 * Require valid auth cookie (JWT). Returns 401 if missing or invalid.
 * Verifies helloworldjunktest.singles row exists on every request (deleted members → sessionInvalid logout).
 * On success, sets req.auth = { singles_id, email } for use by route handlers.
 */
export async function requireAuth(req, res, next) {
  const token = getAuthTokenFromCookies(req.cookies);
  if (!token) {
    console.warn('[requireAuth] 401 missing token', {
      method: req.method,
      path: req.originalUrl || req.path,
      hasCookieHeader: Boolean(req.headers?.cookie)
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });

    if (isToolsOnlyAdminJwt(decoded)) {
      const sysRow = await lookupSystemToolsAdminSingles(pool);
      const decodedSinglesId = Number(decoded.singles_id);
      const legacyToolsOnly = Number(decoded.singles_id) === 0;

      if (!legacyToolsOnly) {
        if (!sysRow?.singles_id || Number(sysRow.singles_id) !== decodedSinglesId) {
          console.warn('[requireAuth] sessionInvalid — tools-only admin row mismatch', {
            method: req.method,
            path: req.originalUrl || req.path,
            singles_id: decoded.singles_id
          });
          return respondSessionInvalid(res);
        }
      }

      req.auth = {
        singles_id: legacyToolsOnly ? 0 : decodedSinglesId,
        email: decoded.email,
        role: 'Admin',
        tools_only: true,
        impersonated_by_admin_id: 0,
        requiresPasswordUpgrade: decoded.requiresPasswordUpgrade === true
      };
      logImpersonatedMutation(req);
      return next();
    }

    const authUser = await withResolvedCustomLogoutMinutes(
      await resolveAuthUserFromJwt(decoded),
      decoded
    );
    if (!authUser) {
      console.warn('[requireAuth] sessionInvalid — singles row missing', {
        method: req.method,
        path: req.originalUrl || req.path,
        singles_id: decoded?.singles_id
      });
      return respondSessionInvalid(res);
    }
    req.auth = {
      ...authUser,
      requiresPasswordUpgrade: decoded.requiresPasswordUpgrade === true
    };

    const gate = await enforceSingleLoginSession(req, res, decoded);
    if (!gate.ok) {
      return res.status(gate.status).json(gate.body);
    }

    logImpersonatedMutation(req);
    if (req.method === 'POST' && req.path === '/api/myPhotos') {
      console.log('[upload trace] 3-requireAuth-OK', { singles_id: authUser.singles_id });
    }
    next();
  } catch (err) {
    console.warn('[requireAuth] 401 invalid token', {
      method: req.method,
      path: req.originalUrl || req.path,
      reason: err?.name || 'UnknownAuthError',
      message: err?.message || 'unknown'
    });
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // DB / pool errors must not be masked as 401 — FE treats 5xx + network as service outage (Service Notice).
    console.error('[requireAuth]', err.message);
    return res.status(503).json({ error: 'E3', message: 'Database connection failed' });
  }
}
