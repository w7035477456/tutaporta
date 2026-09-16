import pool from '../../db/connection.js';
import { backupUserAll, defaultBackupRootForEmail, restoreUserAll } from '../../utils/tutaMallUserBackup.js';
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

/** POST /api/tutaMall/backup-all — backup logged-in member to ~/tutamallBackup/{prefix}/ */
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

/** POST /api/tutaMall/restore-all — restore logged-in member from default backup folder */
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

/** GET /api/tutaMall/backup-status — whether a default backup exists for logged-in member */
export async function getTutaMallBackupStatus(req, res) {
  const singlesId = requireSinglesId(req, res);
  if (!singlesId) return;

  try {
    const { rows } = await pool.query(
      `SELECT email::text AS email FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
      [singlesId]
    );
    const email = String(rows[0]?.email || '').trim();
    const backupDir = defaultBackupRootForEmail(email);
    const manifestPath = path.join(backupDir, 'manifest.json');
    const exists = fs.existsSync(manifestPath);
    let manifest = null;
    if (exists) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    return res.json({ email, backupDir, exists, manifest });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Status check failed' });
  }
}
