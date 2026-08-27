import jwt from 'jsonwebtoken';
import { getPrivateKey } from '../jwtKeys.js';
import { getMallDepartmentMode } from '../mallDepartmentMode.js';
import { getAuthJwtExpiresInSeconds, setAuthCookie } from './authCookie.js';
import { invalidateAuthUserCache, lookupAuthUserBySinglesId } from './authUserLookupCache.js';
import { appLog } from '../logger.js';
import { lookupSystemToolsAdminSingles } from './systemToolsAdmin.js';
import { getRequestClientIp, isAdminIpAllowed } from './adminIpConfig.js';

export const TOOLS_ONLY_ADMIN_LOGIN_ID = 'admin';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** JWT / req.auth role is Admin (impersonation or elevated session). */
export function isAdminAuth(auth) {
  return String(auth?.role ?? '').trim() === 'Admin';
}

/** Global tools login (`admin`) — not impersonating a member. */
export function isToolsOnlyAdminAuth(auth) {
  return auth?.tools_only === true && isAdminAuth(auth);
}

/** Admin impersonating a member — exempt from single-login Redis session (does not kick member). */
export function isAdminImpersonationSession(auth, decoded) {
  if (auth?.tools_only === true) return false;
  if (isToolsOnlyAdminJwt(decoded)) return false;
  if (String(auth?.role ?? decoded?.role ?? '').trim() !== 'Admin') return false;
  const id = Number(auth?.singles_id ?? decoded?.singles_id);
  return Number.isFinite(id) && id >= 1;
}

/** Verified JWT for global tools login (login id "admin"). */
export function isToolsOnlyAdminJwt(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  if (decoded.tools_only === true && String(decoded.role ?? '').trim() === 'Admin') return true;
  // Legacy JWT before system singles row (singles_id 0).
  return String(decoded.role ?? '').trim() === 'Admin' && Number(decoded.singles_id) === 0;
}

export function buildToolsOnlyAdminAuthUser(decoded = {}) {
  return {
    singles_id: 0,
    email: String(decoded.email ?? TOOLS_ONLY_ADMIN_LOGIN_ID).trim() || TOOLS_ONLY_ADMIN_LOGIN_ID,
    role: 'Admin',
    tools_only: true,
    impersonated_by_admin_id: 0
  };
}

export function buildToolsOnlyAdminSessionUser(decoded = {}, sysRow = null) {
  const singlesId =
    sysRow?.singles_id != null && Number.isFinite(Number(sysRow.singles_id))
      ? Number(sysRow.singles_id)
      : Number(decoded.singles_id) || 0;
  const memberCategory = String(sysRow?.member_category ?? 'ADMIN');
  return {
    singles_id: singlesId,
    email: TOOLS_ONLY_ADMIN_LOGIN_ID,
    alias: String(sysRow?.alias ?? 'Admin'),
    role: 'Admin',
    tools_only: true,
    impersonated_by_admin_id: 0,
    member_category: memberCategory,
    mallDepartmentMode: getMallDepartmentMode(memberCategory)
  };
}

/** Resolve req.auth payload from a verified JWT (tools-only admin or singles member). */
export async function resolveAuthUserFromJwt(decoded) {
  if (isToolsOnlyAdminJwt(decoded)) {
    return buildToolsOnlyAdminAuthUser(decoded);
  }
  return lookupAuthUserBySinglesId(decoded.singles_id, {
    fallbackEmail: decoded.email,
    jwtClaims: decoded
  });
}

/** Express middleware — requires req.auth.role === 'Admin' with strict JWT claim checks. */
export function requireAdminRole(req, res, next) {
  if (!isAdminIpAllowed(req)) {
    appLog.warn('[requireAdminRole] reject: client IP not in ADMIN_IP allowlist', {
      clientIp: getRequestClientIp(req)
    });
    return res.status(403).json({ error: 'Admin access is not allowed from this network.' });
  }

  const auth = req.auth;
  if (!auth || !isAdminAuth(auth)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (auth.tools_only === true) {
    const loginEmail = String(auth.email ?? '').trim().toLowerCase();
    if (loginEmail !== TOOLS_ONLY_ADMIN_LOGIN_ID) {
      appLog.warn('[requireAdminRole] reject tools-only JWT: unexpected email claim', { loginEmail });
      return res.status(403).json({ error: 'Admin access required' });
    }
    const singlesId = Number(auth.singles_id);
    if (singlesId !== 0 && (!Number.isFinite(singlesId) || singlesId < 1)) {
      appLog.warn('[requireAdminRole] reject tools-only JWT: invalid singles_id', { singlesId: auth.singles_id });
      return res.status(403).json({ error: 'Admin access required' });
    }
  }

  next();
}

/**
 * Issue Admin impersonation JWT cookie.
 * Does not call startSingleLoginSession — impersonation must not replace the member's Redis session.
 * @param {import('express').Response} res
 * @param {object} user — singles row (password_hash stripped in response)
 * @param {{ impersonatedByAdminId?: number, rememberMe?: boolean, log?: Function }} [opts]
 */
export async function issueAdminAuthSession(res, user, { impersonatedByAdminId = 0, rememberMe = false, log } = {}) {
  const { password_hash: _pw, ...userWithoutPassword } = user;
  const singlesId = user.singles_id;

  await invalidateAuthUserCache(singlesId);

  const token = jwt.sign(
    {
      singles_id: singlesId,
      email: user.email,
      role: 'Admin',
      impersonated_by_admin_id: impersonatedByAdminId
    },
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: getAuthJwtExpiresInSeconds({ rememberMe })
    }
  );

  setAuthCookie(res, token, { rememberMe });

  const mallDepartmentMode = getMallDepartmentMode(userWithoutPassword.member_category);

  if (typeof log === 'function') {
    log('[adminAuth] → admin impersonation success', {
      singles_id: singlesId,
      impersonated_by_admin_id: impersonatedByAdminId
    });
  }
  appLog.info('[adminAuth] session issued', {
    target_singles_id: singlesId,
    impersonated_by_admin_id: impersonatedByAdminId
  });

  return {
    success: true,
    role: 'Admin',
    impersonated_by_admin_id: impersonatedByAdminId,
    user: {
      ...userWithoutPassword,
      mallDepartmentMode,
      role: 'Admin',
      impersonated_by_admin_id: impersonatedByAdminId
    }
  };
}

/**
 * Issue Admin JWT for global tools login (login id "admin", no singles_id).
 * @param {import('express').Response} res
 * @param {{ rememberMe?: boolean, log?: Function }} [opts]
 */
export async function issueToolsOnlyAdminAuthSession(res, { rememberMe = false, log } = {}) {
  const sysRow = await lookupSystemToolsAdminSingles();
  if (!sysRow?.singles_id) {
    const err = new Error('System tools admin row is missing. Run be/db/addSystemToolsAdminSinglesRow.sql on Primary.');
    err.code = 'SYSTEM_TOOLS_ADMIN_MISSING';
    throw err;
  }

  const singlesId = Number(sysRow.singles_id);
  const token = jwt.sign(
    {
      singles_id: singlesId,
      email: TOOLS_ONLY_ADMIN_LOGIN_ID,
      role: 'Admin',
      tools_only: true,
      impersonated_by_admin_id: 0
    },
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: getAuthJwtExpiresInSeconds({ rememberMe })
    }
  );

  setAuthCookie(res, token, { rememberMe });

  if (typeof log === 'function') {
    log('[adminAuth] → tools-only admin success', { singles_id: singlesId });
  }
  appLog.info('[adminAuth] tools-only session issued', { singles_id: singlesId });

  return {
    success: true,
    role: 'Admin',
    tools_only: true,
    impersonated_by_admin_id: 0,
    user: buildToolsOnlyAdminSessionUser({ singles_id: singlesId }, sysRow)
  };
}

/** Best-effort audit when an admin impersonation session mutates data. */
export function logImpersonatedMutation(req) {
  const auth = req.auth;
  if (!auth || auth.impersonated_by_admin_id == null) return;
  if (!MUTATING_METHODS.has(String(req.method ?? '').toUpperCase())) return;

  appLog.info('[impersonation-audit]', {
    impersonated_by_admin_id: auth.impersonated_by_admin_id,
    acting_as_singles_id: auth.singles_id,
    method: req.method,
    path: req.originalUrl || req.path
  });
}
