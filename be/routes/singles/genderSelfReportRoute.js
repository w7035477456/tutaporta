import pool from '../../db/connection.js';
import {
  ensureSeededDemoBuddiesOnLogin,
  normalizeGenderSelfReport,
  saveGenderSelfReportAndSeedDemoBuddies
} from '../../utils/ensureSeededDemoBuddiesOnLogin.js';

/**
 * POST /api/singles/gender-self-report
 * Body: { male: true|false } or { gender: 'M'|'F' }
 * Saves singles.gender_self_report, then runs male/female demo-buddy seed.
 */
export async function postGenderSelfReport(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const gender =
    normalizeGenderSelfReport(req.body?.gender) ??
    (typeof req.body?.male === 'boolean' ? normalizeGenderSelfReport(req.body.male) : null);

  if (gender !== 'M' && gender !== 'F') {
    return res.status(400).json({ error: "gender ('M'|'F') or male (boolean) is required" });
  }

  try {
    const result = await saveGenderSelfReportAndSeedDemoBuddies(pool, singlesId, gender);
    return res.json({
      ok: true,
      gender_self_report: result.gender ?? gender,
      seeded_demo_buddies_boolean: result.seeded === true || result.reason === 'already_seeded',
      seed: {
        skipped: Boolean(result.skipped),
        reason: result.reason ?? null,
        pack: result.pack ?? null,
        error: result.error ?? null
      }
    });
  } catch (err) {
    const message = String(err?.message ?? err);
    console.error('[postGenderSelfReport]', message);
    if (/Refusing to seed|Demo friend missing|no profile_image_fk|not owned|Invalid singles|must be/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    return res.status(500).json({ error: 'Failed to save gender / seed demo buddies.' });
  }
}

/**
 * POST /api/singles/seed-demo-buddies
 * Retries seed using existing gender_self_report (e.g. after profile photo is set).
 */
export async function postSeedDemoBuddies(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await ensureSeededDemoBuddiesOnLogin(pool, singlesId);
    return res.json({
      ok: true,
      seeded_demo_buddies_boolean: result.seeded === true || result.reason === 'already_seeded',
      gender_self_report: result.gender ?? null,
      seed: {
        skipped: Boolean(result.skipped),
        reason: result.reason ?? null,
        pack: result.pack ?? null,
        error: result.error ?? null
      }
    });
  } catch (err) {
    const message = String(err?.message ?? err);
    console.error('[postSeedDemoBuddies]', message);
    return res.status(500).json({ error: 'Failed to seed demo buddies.' });
  }
}
