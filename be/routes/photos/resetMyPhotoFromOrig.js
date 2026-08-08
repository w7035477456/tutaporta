import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { getPhotoFolder } from './uploadPhoto.js';
import { regeneratePhotoThumbnail } from '../../utils/photoThumbnail.js';

function normalizePhotoFileNameBase(raw, fallbackId) {
  const value = String(raw || '').trim();
  if (!value) return String(fallbackId);
  return value.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
}

/**
 * POST /api/myPhotos/:id/resetOriginal
 * If {photo_file_name}orig.jpg exists: copy it over the main slot as {photo_file_name}.jpg and set file_extension to jpg.
 * If missing: no disk change, { restored: false }.
 */
export async function resetMyPhotoFromOrig(req, res) {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    const row = await pool.query(`SELECT photos_id, singles_id, file_extension, photo_file_name FROM helloworldjunktest.photos WHERE photos_id = $1 LIMIT 1`, [id]);
    if (!row.rows.length || Number(row.rows[0].singles_id) !== Number(singlesId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    let photoFolder;
    try {
      photoFolder = getPhotoFolder();
    } catch (e) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in .env' });
    }

    const filePathDir = path.resolve(photoFolder);
    const fileBase = normalizePhotoFileNameBase(row.rows[0].photo_file_name, id);
    const origPath = path.join(filePathDir, `${fileBase}orig.jpg`);
    const legacyOrigPath = path.join(filePathDir, `${id}orig.jpg`);
    const backupPath = fs.existsSync(origPath) ? origPath : legacyOrigPath;

    if (!fs.existsSync(backupPath)) {
      return res.json({ ok: true, restored: false });
    }

    const backupBuf = fs.readFileSync(backupPath);
    const exts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    for (const e of exts) {
      const p = path.join(filePathDir, `${fileBase}.${e}`);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (_) {
          /* ignore */
        }
      }
    }

    const mainJpg = path.join(filePathDir, `${fileBase}.jpg`);
    fs.writeFileSync(mainJpg, backupBuf);
    await pool.query(`UPDATE helloworldjunktest.photos SET file_extension = $1 WHERE photos_id = $2`, ['jpg', id]);
    await regeneratePhotoThumbnail(pool, id, backupBuf);

    console.log('[resetMyPhotoFromOrig] restored', id, 'from', backupPath);
    res.json({ ok: true, restored: true, file_extension: 'jpg' });
  } catch (err) {
    console.error('resetMyPhotoFromOrig error:', err);
    res.status(500).json({ error: 'Failed to reset photo' });
  }
}
