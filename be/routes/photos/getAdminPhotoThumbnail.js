import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { extToContentType } from '../../utils/albumUploadFormats.js';
import { getPhotoFolder, resolvePhotoFilePath } from '../../utils/photoFilePath.js';
import { resolvePhotoThumbnailPath } from '../../utils/photoThumbnail.js';

/**
 * GET /api/admin/photo/:id/thumbnail — admin JPEG thumbnail (falls back to full image).
 */
export async function getAdminPhotoThumbnail(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    const row = await pool.query(
      `SELECT file_extension, photo_file_name, photo_thumbnail, file_path
       FROM helloworldjunktest.photos
       WHERE photos_id = $1
       LIMIT 1`,
      [id]
    );

    if (row.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { file_extension: fileExt, photo_file_name: photoFileName, photo_thumbnail: photoThumbnail, file_path: filePathFromDb } =
      row.rows[0];
    const photoFolder = getPhotoFolder();
    if (!photoFolder) {
      return res.status(500).json({ error: 'VSINGLES_PHOTO_FOLDER not configured' });
    }

    const thumbPath = resolvePhotoThumbnailPath(photoThumbnail, filePathFromDb || photoFolder);
    const sendPath = thumbPath || resolvePhotoFilePath(photoFolder, photoFileName, id, String(fileExt || 'jpg').replace(/^\./, ''));
    if (!sendPath) {
      return res.status(404).json({ error: 'Photo file not found on disk' });
    }

    const resolved = path.resolve(sendPath);
    const st = fs.statSync(resolved);
    const ext = thumbPath ? 'jpg' : String(fileExt || 'jpg').replace(/^\./, '');
    res.set('Content-Type', extToContentType(ext));
    res.set('Cache-Control', 'private, max-age=300');
    res.set('ETag', `"${st.mtimeMs}-${st.size}"`);
    if (req.headers['if-none-match'] === res.get('ETag')) {
      return res.status(304).end();
    }
    return res.sendFile(resolved);
  } catch (error) {
    console.error('[getAdminPhotoThumbnail]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load photo thumbnail' });
  }
}
