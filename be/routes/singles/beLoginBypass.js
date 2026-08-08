import pool from '../../db/connection.js';
import jwt from 'jsonwebtoken';
import { getMallDepartmentMode } from '../../mallDepartmentMode.js';
import { getPrivateKey } from '../../jwtKeys.js';
import { getAuthJwtExpiresInSeconds, setAuthCookie } from '../../utils/authCookie.js';
import { startSingleLoginSession } from '../../utils/singleLoginSession.js';
import { resolveCustomLogoutMinutes } from '../../utils/customLogoutDuration.js';

function getSpecialLoginEmail() {
  return String(process.env.SPECIAL_ID ?? '').trim();
}

/**
 * GET /api/loginBypass
 * Optional dev bypass (ENABLE_LOGIN_BYPASS=true, non-production): logs in as SPECIAL_ID with no password.
 */
export async function beLoginBypass(req, res) {
  const bypassEmail = getSpecialLoginEmail();
  if (!bypassEmail) {
    return res.status(503).json({ error: 'SPECIAL_ID is not configured in ~/.ssh/be/.env' });
  }
  try {
    try {
      const result = await pool.query(
        `SELECT singles_id, prefix, member_id, alias, email, profile_image_fk, member_category
         FROM helloworldjunktest.singles s
         WHERE s.email = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
        [bypassEmail]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: `Bypass user not found: ${bypassEmail}` });
      }
      const user = result.rows[0];
      const logoutMins = await resolveCustomLogoutMinutes(user.singles_id);
      const sessionId = await startSingleLoginSession(user.singles_id, logoutMins);
      const tokenPayload = {
        singles_id: user.singles_id,
        email: user.email,
        custom_logout_duration: logoutMins
      };
      if (sessionId) {
        tokenPayload.session_id = sessionId;
      }
      const token = jwt.sign(tokenPayload, getPrivateKey(), {
        algorithm: 'RS256',
        expiresIn: getAuthJwtExpiresInSeconds({ rememberMe: false })
      });

      setAuthCookie(res, token);

      const mallDepartmentMode = getMallDepartmentMode(user.member_category);
      return res.json({ success: true, user: { ...user, mallDepartmentMode } });
    } catch (dbErr) {
      console.error('[beLoginBypass] DB query error:', dbErr.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } catch (err) {
    console.error('[beLoginBypass] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
