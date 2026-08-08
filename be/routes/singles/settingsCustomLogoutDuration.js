import pool from '../../db/connection.js';
import { isAdminAuth } from '../../utils/adminAuth.js';
import {
  DEFAULT_CUSTOM_LOGOUT_DURATION,
  fetchCustomLogoutDuration,
  getLogoutDurationPresets,
  normalizeCustomLogoutDuration,
  parseLogoutAutoMinutes,
  setCustomLogoutDuration
} from '../../utils/customLogoutDuration.js';

async function resolveAdminCustomAllowed(singlesId, auth) {
  if (isAdminAuth(auth)) return true;
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  try {
    const { rows } = await pool.query(
      `SELECT member_category
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [id]
    );
    return String(rows[0]?.member_category ?? '').trim().toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function getSettingsCustomLogoutDuration(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const minutes = await fetchCustomLogoutDuration(singlesId);
    const adminCustomAllowed = await resolveAdminCustomAllowed(singlesId, req.auth);
    return res.json({
      custom_logout_duration: minutes,
      admin_custom_allowed: adminCustomAllowed,
      logout_auto_min: parseLogoutAutoMinutes(),
      logout_presets: getLogoutDurationPresets()
    });
  } catch (err) {
    console.error('[settingsCustomLogoutDuration:get]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load auto logout setting' });
  }
}

export async function updateSettingsCustomLogoutDuration(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const raw = req.body?.custom_logout_duration ?? req.body?.minutes;
  const adminAllowed = await resolveAdminCustomAllowed(singlesId, req.auth);
  const minutes = normalizeCustomLogoutDuration(raw, { adminAllowed });
  if (minutes == null) {
    const presets = getLogoutDurationPresets();
    return res.status(400).json({
      error: adminAllowed
        ? 'custom_logout_duration must be a positive integer (minutes)'
        : `custom_logout_duration must be one of: ${presets.join(', ')}`
    });
  }

  try {
    await setCustomLogoutDuration(singlesId, minutes);
    return res.json({
      ok: true,
      custom_logout_duration: minutes
    });
  } catch (err) {
    console.error('[settingsCustomLogoutDuration:put]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to save auto logout setting' });
  }
}

export { DEFAULT_CUSTOM_LOGOUT_DURATION };
