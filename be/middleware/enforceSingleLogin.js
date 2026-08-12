import { isAdminImpersonationSession, isToolsOnlyAdminJwt } from '../utils/adminAuth.js';
import { validateSingleLoginSession } from '../utils/singleLoginSession.js';
import { clearRecordVaultCacheIcon } from '../utils/recordVaultCacheIcon.js';

function shouldSkipSingleLogin(auth, decoded) {
  if (!auth) return true;
  if (auth.tools_only === true) return true;
  if (isToolsOnlyAdminJwt(decoded)) return true;
  if (isAdminImpersonationSession(auth, decoded)) return true;
  // demo/demo and guest/guest share one singles row — allow concurrent sessions.
  if (decoded?.guest_demo_login === true) return true;
  const id = Number(auth.singles_id);
  return !Number.isFinite(id) || id < 1;
}

function sessionErrorBody(result) {
  if (result.code === 'sessionSuperseded') {
    return {
      error: 'Authentication required',
      sessionSuperseded: true
    };
  }
  return {
    error: 'Authentication required',
    sessionExpired: true,
    custom_logout_duration: result.customLogoutDuration ?? 60
  };
}

/** After JWT auth: ensure JWT session_id matches Redis (one device per account).
 * Skips guest_demo_login (demo/demo, guest/guest) so multiple demos can stay signed in. */
export async function enforceSingleLoginSession(req, res, decoded) {
  if (shouldSkipSingleLogin(req.auth, decoded)) {
    return { ok: true };
  }

  const singlesId = Number(req.auth.singles_id);
  const result = await validateSingleLoginSession(singlesId, decoded?.session_id, {
    cachedLogoutMinutes: req.auth?.custom_logout_duration,
    logoutMinutes: req.auth?.custom_logout_duration
  });
  if (!result.ok) {
    // Idle / Redis session expiry — same as logout: drop remembered MyNote icons.
    if (result.code === 'sessionExpired') {
      try {
        await clearRecordVaultCacheIcon(singlesId);
      } catch (err) {
        console.error('[enforceSingleLogin] clearRecordVaultCacheIcon', err?.message || err);
      }
    }
    return {
      ok: false,
      status: 401,
      body: sessionErrorBody(result)
    };
  }

  return { ok: true };
}
