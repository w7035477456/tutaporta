import pool from '../../db/connection.js';
import {
  backupUserAll,
  backupUserSection,
  defaultBackupRootForEmail,
  normalizeBackupApp,
  restoreUserAll,
  restoreUserSection,
  sectionBackupExists,
  sectionCreatedAt
} from '../../utils/tutaMallUserBackup.js';
import fs from 'fs';
import path from 'path';

function requireSinglesId(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return singlesId;
}

function readManifestSafe(backupDir) {
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/** POST /api/tutaMall/backup-all — backup all apps (CLI / legacy) */
export async function postTutaMallBackupAll(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const result = await backupUserAll(pool, { singlesId });
    return res.json({
      ok: true,
      email: result.email,
      singlesId: result.singlesId,
      memberId: result.memberId,
      backupDir: result.backupDir,
      manifest: result.manifest,
      copied: result.summary.copied.length,
      skipped: result.summary.skipped.length
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Backup failed' });
  }
}

/** POST /api/tutaMall/backup — backup one app (tutadates | tutanotes | tutaphoto) */
export async function postTutaMallBackupApp(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  let app;
  try {
    app = normalizeBackupApp(req.body?.app || req.query?.app);
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'Invalid app' });
  }

  try {
    const result = await backupUserSection(pool, { singlesId, app });
    return res.json({
      ok: true,
      app: result.section,
      email: result.email,
      singlesId: result.singlesId,
      memberId: result.memberId,
      backupDir: result.backupDir,
      manifest: result.manifest,
      copied: result.summary.copied.length,
      skipped: result.summary.skipped.length
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Backup failed' });
  }
}

/** POST /api/tutaMall/restore-all — restore all apps from backup folder (CLI / legacy) */
export async function postTutaMallRestoreAll(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  if (req.body?.confirm !== true) {
    return res.status(400).json({
      error: 'Restore requires confirm:true — this overwrites TutaNotes, TutaPhoto, and TutaDates data.'
    });
  }

  try {
    const result = await restoreUserAll(pool, { singlesId });
    return res.json({
      ok: true,
      email: result.email,
      singlesId: result.singlesId,
      memberId: result.memberId,
      backupDir: result.backupDir,
      manifest: result.manifest,
      restored: result.summary.restored.length,
      skipped: result.summary.skipped.length
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Restore failed' });
  }
}

/** POST /api/tutaMall/restore — restore one app from backup folder */
export async function postTutaMallRestoreApp(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  if (req.body?.confirm !== true) {
    return res.status(400).json({
      error: 'Restore requires confirm:true — this overwrites live data for the selected app.'
    });
  }

  let app;
  try {
    app = normalizeBackupApp(req.body?.app || req.query?.app);
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'Invalid app' });
  }

  try {
    const result = await restoreUserSection(pool, { singlesId, app });
    return res.json({
      ok: true,
      app: result.section,
      email: result.email,
      singlesId: result.singlesId,
      memberId: result.memberId,
      backupDir: result.backupDir,
      manifest: result.manifest,
      restored: result.summary.restored.length,
      skipped: result.summary.skipped.length
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Restore failed' });
  }
}

/** GET /api/tutaMall/backup-status — optional ?app=tutadates for per-app restore stamp */
export async function getTutaMallBackupStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  let app = null;
  if (req.query?.app) {
    try {
      app = normalizeBackupApp(req.query.app);
    } catch (err) {
      return res.status(400).json({ error: err?.message || 'Invalid app' });
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT email::text AS email FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    const email = String(rows[0]?.email || '').trim();
    const backupDir = defaultBackupRootForEmail(email);
    const manifest = readManifestSafe(backupDir);
    const exists = app
      ? sectionBackupExists(backupDir, app)
      : Boolean(manifest && fs.existsSync(path.join(backupDir, 'manifest.json')));
    const sectionCreatedAtValue = app ? sectionCreatedAt(manifest, app, backupDir) : manifest?.createdAt || null;

    return res.json({
      email,
      backupDir,
      app,
      exists,
      manifest,
      sectionCreatedAt: sectionCreatedAtValue
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Status check failed' });
  }
}
