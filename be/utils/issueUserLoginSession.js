import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { getPrivateKey } from '../jwtKeys.js';
import { getMallDepartmentMode } from '../mallDepartmentMode.js';
import { getAuthJwtExpiresInSeconds, setAuthCookie } from './authCookie.js';
import { startSingleLoginSession } from './singleLoginSession.js';
import { resolveCustomLogoutMinutes } from './customLogoutDuration.js';
import { ensureDemoRegularInitialSetupDone } from './ensureDemoRegularInitialSetupDone.js';
import { ensureSeededDemoBuddiesOnLogin } from './ensureSeededDemoBuddiesOnLogin.js';
import { insertDemoLoginLog } from './loginLog.js';
import { normalizeOver18Verified } from './over18Verified.js';

/**
 * Issue JWT + auth cookie for a singles row (password login, Google OAuth, etc.).
 * Sets the cookie on `res` and returns the same JSON body password login uses.
 */
export async function issueUserLoginSession(res, user, options = {}) {
  const {
    rememberMe = false,
    requiresPasswordUpgrade = false,
    guestDemoLogin = false,
    req = null,
    loginLogSessionToken = null,
    loginAlias = null,
    log = () => {}
  } = options;

  const { password_hash: _passwordHash, ...userWithoutPassword } = user;

  try {
    await ensureDemoRegularInitialSetupDone(pool, user.singles_id, user.member_category);
  } catch (err) {
    console.error('[issueUserLoginSession] ensureDemoRegularInitialSetupDone:', err?.message ?? err);
  }

  try {
    await ensureSeededDemoBuddiesOnLogin(pool, user.singles_id);
  } catch (err) {
    console.error('[issueUserLoginSession] ensureSeededDemoBuddiesOnLogin:', err?.message ?? err);
  }

  try {
    const flagsRes = await pool.query(
      `SELECT seeded_demo_buddies_boolean, gender_self_report, over_18_verified,
              (NULLIF(BTRIM(COALESCE(secret_icon::text, '')), '') IS NOT NULL) AS has_secret_icon
       FROM helloworldjunktest.singles
       WHERE singles_id = $1`,
      [user.singles_id]
    );
    if (flagsRes.rows[0]) {
      userWithoutPassword.seeded_demo_buddies_boolean = flagsRes.rows[0].seeded_demo_buddies_boolean;
      userWithoutPassword.gender_self_report = flagsRes.rows[0].gender_self_report;
      userWithoutPassword.over_18_verified = flagsRes.rows[0].over_18_verified;
      userWithoutPassword.has_secret_icon = flagsRes.rows[0].has_secret_icon;
    }
  } catch (err) {
    console.error('[issueUserLoginSession] refresh seed flags:', err?.message ?? err);
  }

  const logoutMins = await resolveCustomLogoutMinutes(user.singles_id);
  const tokenPayload = {
    singles_id: user.singles_id,
    email: user.email,
    custom_logout_duration: logoutMins
  };
  if (guestDemoLogin) {
    tokenPayload.guest_demo_login = true;
    if (loginLogSessionToken) {
      tokenPayload.login_log_session = loginLogSessionToken;
    }
  }
  if (requiresPasswordUpgrade) {
    tokenPayload.requiresPasswordUpgrade = true;
  } else if (guestDemoLogin) {
    // Concurrent demo/guest alias sessions — skip Redis session_id.
  } else {
    const sessionId = await startSingleLoginSession(user.singles_id, logoutMins);
    if (sessionId) {
      tokenPayload.session_id = sessionId;
    }
  }

  if (guestDemoLogin && req) {
    await insertDemoLoginLog(req, {
      singlesId: user.singles_id,
      email: user.email,
      sessionToken: loginLogSessionToken,
      loginAlias
    });
  }

  const token = jwt.sign(tokenPayload, getPrivateKey(), {
    algorithm: 'RS256',
    expiresIn: getAuthJwtExpiresInSeconds({ rememberMe })
  });

  setAuthCookie(res, token, { rememberMe });

  log('[issueUserLoginSession] success', {
    singles_id: user.singles_id,
    role: 'user',
    requiresPasswordUpgrade: Boolean(requiresPasswordUpgrade),
    guestDemoLogin: Boolean(guestDemoLogin)
  });

  const mallDepartmentMode = getMallDepartmentMode(userWithoutPassword.member_category);
  const seededDemoBuddies =
    String(userWithoutPassword.seeded_demo_buddies_boolean ?? '').trim().toLowerCase() === 'true' ||
    userWithoutPassword.seeded_demo_buddies_boolean === true;
  const genderRaw = String(userWithoutPassword.gender_self_report ?? '')
    .trim()
    .toUpperCase();
  const genderSelfReport = genderRaw === 'M' || genderRaw === 'F' ? genderRaw : null;
  const over18Verified = normalizeOver18Verified(userWithoutPassword.over_18_verified);
  const hasSecretIcon =
    userWithoutPassword.has_secret_icon === true ||
    String(userWithoutPassword.has_secret_icon ?? '')
      .trim()
      .toLowerCase() === 'true';

  return {
    success: true,
    role: 'user',
    user: {
      ...userWithoutPassword,
      mallDepartmentMode,
      guest_demo_login: Boolean(guestDemoLogin),
      seeded_demo_buddies_boolean: seededDemoBuddies,
      gender_self_report: genderSelfReport,
      over_18_verified: over18Verified,
      has_secret_icon: hasSecretIcon
    },
    requiresPasswordUpgrade: Boolean(requiresPasswordUpgrade)
  };
}
