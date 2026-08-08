import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import pool from '../../db/connection.js';
import {
  getPhotoFolder,
  getMaxUploadBytes,
  getMaxUploadMb,
  contentTypeToExt,
  resizeToFit
} from './uploadPhoto.js';
import { regeneratePhotoThumbnail } from '../../utils/photoThumbnail.js';
import {
  ALBUM_PHOTO_EXTENSIONS_ERROR,
  isAllowedAlbumPhotoContentType,
  isPassthroughAlbumPhotoExtension,
  normalizePhotoExtension
} from '../../utils/albumUploadFormats.js';
import { isAdminImpersonationSession } from '../../utils/adminAuth.js';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/** First-save backup: {fileBase}orig.jpg — skipped if that file already exists. */
async function ensureOriginalBackupJpeg(fileBase, filePathDir, currentExt) {
  const origPath = path.join(filePathDir, `${fileBase}orig.jpg`);
  if (fs.existsSync(origPath)) return;
  const ext = (currentExt || 'jpg').replace(/^\./, '');
  const mainPath = path.join(filePathDir, `${fileBase}.${ext}`);
  if (!fs.existsSync(mainPath)) {
    console.log('[updateMyPhoto] skip backup — main file missing', mainPath);
    return;
  }
  try {
    const buf = fs.readFileSync(mainPath);
    await sharp(buf).jpeg({ quality: 92 }).toFile(origPath);
    console.log('[updateMyPhoto] created original backup', origPath);
  } catch (e) {
    console.error('[updateMyPhoto] backup to orig.jpg failed', e.message);
    throw new Error('Could not create backup before save');
  }
}

function normalizePhotoFileNameBase(raw, fallbackId) {
  const value = String(raw || '').trim();
  if (!value) return String(fallbackId);
  return value.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
}

/**
 * PUT /api/myPhotos/:id
 * Body: { image: "data:image/jpeg;base64,..." } — overwrites on-disk file for this photos_id (must belong to auth user).
 */
export async function updateMyPhoto(req, res) {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    const row = await pool.query(`SELECT photos_id, file_extension, photo_file_name, singles_id FROM helloworldjunktest.photos WHERE photos_id = $1 LIMIT 1`, [
      id
    ]);
    if (!row.rows.length || Number(row.rows[0].singles_id) !== Number(singlesId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    let photoFolder;
    try {
      photoFolder = getPhotoFolder();
    } catch (e) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER is not set in .env' });
    }

    const { image: dataUrl, file_extension: fileExtensionHint } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Missing image (data URL or base64)' });
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const contentType = match ? match[1].trim().toLowerCase() : 'image/jpeg';
    const base64 = match ? match[2] : dataUrl;
    const fileExtension = normalizePhotoExtension(fileExtensionHint);

    if (!isAllowedAlbumPhotoContentType(contentType, fileExtension)) {
      return res.status(400).json({
        error: `Image type not allowed. Only ${ALBUM_PHOTO_EXTENSIONS_ERROR} are accepted.`
      });
    }

    let buffer = Buffer.from(base64, 'base64');
    let finalContentType = contentType;
    const sizeBefore = buffer.length;
    const skipUploadSizeLimit = isAdminImpersonationSession(req.auth);
    const maxBytes = getMaxUploadBytes();
    const maxMb = getMaxUploadMb();
    const targetBytes = Math.floor(maxBytes * 0.95);
    const resolvedExt = contentTypeToExt(contentType, fileExtension);
    const passthrough = isPassthroughAlbumPhotoExtension(resolvedExt);

    if (!skipUploadSizeLimit && buffer.length > maxBytes) {
      if (passthrough) {
        const sizeMb = (sizeBefore / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          error: `File size is ${sizeMb} mb. Maximum we allow is ${maxMb} mb`
        });
      }
      try {
        const resized = await resizeToFit(buffer, contentType, targetBytes);
        buffer = resized.buffer;
        finalContentType = resized.contentType;
      } catch (resizeErr) {
        console.error('[updateMyPhoto] resize failed:', resizeErr);
      }
      if (buffer.length > maxBytes) {
        const sizeMb = (sizeBefore / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          error: `File size is ${sizeMb} mb. Maximum we allow is ${maxMb} mb`
        });
      }
    }

    const filePathDir = path.resolve(photoFolder);
    fs.mkdirSync(filePathDir, { recursive: true });

    const fileBase = normalizePhotoFileNameBase(row.rows[0].photo_file_name, id);
    const oldExt = (row.rows[0].file_extension || 'jpg').replace(/^\./, '');
    await ensureOriginalBackupJpeg(fileBase, filePathDir, oldExt);

    const newExt = contentTypeToExt(finalContentType, fileExtension);
    const oldPath = path.join(filePathDir, `${fileBase}.${oldExt}`);
    const newPath = path.join(filePathDir, `${fileBase}.${newExt}`);

    console.log('[updateMyPhoto] singles_id=', singlesId, 'photo_id=', id, 'write', newPath, formatBytes(buffer.length));

    fs.writeFileSync(newPath, buffer);
    if (oldPath !== newPath && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (_) {
        /* ignore */
      }
    }

    if (newExt !== oldExt) {
      await pool.query(`UPDATE helloworldjunktest.photos SET file_extension = $1 WHERE photos_id = $2`, [newExt, id]);
    }

    await regeneratePhotoThumbnail(pool, id, buffer);

    res.json({ ok: true, photos_id: id, file_extension: newExt });
  } catch (err) {
    console.error('updateMyPhoto error:', err);
    if (err?.code === '42703') {
      return res.status(500).json({
        error: 'Database schema outdated.'
      });
    }
    res.status(500).json({ error: 'Failed to save photo' });
  }
}
