import jwt from 'jsonwebtoken';
import pool from '../../db/connection.js';
import { getPublicKey } from '../../jwtKeys.js';
import {
  issueAdminAuthSession,
  issueToolsOnlyAdminAuthSession,
  isAdminImpersonationSession,
  isToolsOnlyAdminAuth
} from '../../utils/adminAuth.js';
import { verifyGlobalToolsPassword } from '../../utils/globalToolsPassword.js';
import { getRequestClientIp, isAdminIpAllowed } from '../../utils/adminIpConfig.js';
import { getAuthTokenFromCookies } from '../../utils/authCookie.js';
import { appLog } from '../../logger.js';

async function loadTargetUser(targetSinglesId) {
  const result = await pool.query(
    `SELECT singles_id, prefix, member_id, alias, email, profile_image_fk, member_category
     FROM helloworldjunktest.singles
     WHERE singles_id = $1`,
    [targetSinglesId]
  );
  return result.rows[0] ?? null;
}

function resolveImpersonatorIdFromToken(decoded) {
  const raw = decoded?.impersonated_by_admin_id;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  return 0;
}

/**
 * POST /api/admin/impersonate
 * Body: { target_singles_id, password? }
 * - Global tools password (global.password_hash), or
 * - Existing JWT with role === 'Admin'
 */
export async function adminImpersonate(req, res) {
  const targetSinglesId = Number(req.body?.target_singles_id);
  const password = String(req.body?.password ?? '').trim();

  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
    return res.status(400).json({ error: 'target_singles_id is required' });
  }

  if (!isAdminIpAllowed(req)) {
    appLog.warn('[adminImpersonate] reject: client IP not in ADMIN_IP allowlist', {
      clientIp: getRequestClientIp(req),
      target_singles_id: targetSinglesId
    });
    return res.status(403).json({ error: 'Admin login is not allowed from this network.' });
  }

  let authorized = false;
  let impersonatedByAdminId = 0;

  const existingToken = getAuthTokenFromCookies(req.cookies);
  if (existingToken) {
    try {
      const decoded = jwt.verify(existingToken, getPublicKey(), { algorithms: ['RS256'] });
      if (String(decoded?.role ?? '').trim() === 'Admin') {
        authorized = true;
        impersonatedByAdminId = resolveImpersonatorIdFromToken(decoded);
      }
    } catch {
      // fall through to password check
    }
  }

  if (!authorized) {
    if (!password) {
      return res.status(401).json({ error: 'Admin password required' });
    }
    const ok = await verifyGlobalToolsPassword(password);
    if (!ok) {
      return res.status(403).json({ error: 'Invalid admin password' });
    }
    authorized = true;
    impersonatedByAdminId = 0;
  }

  const targetUser = await loadTargetUser(targetSinglesId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target member not found' });
  }

  const body = await issueAdminAuthSession(res, targetUser, {
    impersonatedByAdminId,
    log: (msg, data) => appLog.info(msg, data)
  });
  return res.json(body);
}

/**
 * POST /api/admin/return-admin
 * End member impersonation and restore tools-only Admin session.
 * Requires an active Admin impersonation JWT (not tools-only).
 */
export async function adminReturnAdmin(req, res) {
  if (!isAdminIpAllowed(req)) {
    appLog.warn('[adminReturnAdmin] reject: client IP not in ADMIN_IP allowlist', {
      clientIp: getRequestClientIp(req)
    });
    return res.status(403).json({ error: 'Admin login is not allowed from this network.' });
  }

  const auth = req.auth;
  if (!auth || String(auth.role ?? '').trim() !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (isToolsOnlyAdminAuth(auth)) {
    return res.status(400).json({ error: 'Already in tools-only admin mode.' });
  }

  if (!isAdminImpersonationSession(auth)) {
    return res.status(403).json({ error: 'Not in an impersonation session.' });
  }

  try {
    const body = await issueToolsOnlyAdminAuthSession(res, {
      log: (msg, data) => appLog.info(msg, data)
    });
    appLog.info('[adminReturnAdmin] restored tools-only admin', {
      from_singles_id: auth.singles_id,
      impersonated_by_admin_id: auth.impersonated_by_admin_id
    });
    return res.json(body);
  } catch (err) {
    if (err?.code === 'SYSTEM_TOOLS_ADMIN_MISSING') {
      return res.status(500).json({ error: err.message });
    }
    appLog.error('[adminReturnAdmin] failed', { error: err?.message ?? err });
    return res.status(500).json({ error: 'Unable to return to admin mode.' });
  }
}
