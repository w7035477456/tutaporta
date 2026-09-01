import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { getVideoFolder, resolveVideoFilePath } from '../../utils/videoFilePath.js';

function getVideoCacheControlHeaderValue() {
  const forever = ['1', 'true', 'yes', 'y', 'on'].includes(
    String(process.env.PHOTO_BROWSER_CACHE_FOREVER ?? '').trim().toLowerCase()
  );
  if (forever) return 'private, max-age=31536000, immutable';
  const raw = Number.parseInt(String(process.env.PHOTO_BROWSER_CACHE_MAX_AGE_SEC ?? ''), 10);
  const maxAge = Number.isFinite(raw) ? Math.max(0, Math.min(31536000, raw)) : 300;
  return `private, max-age=${maxAge}`;
}

/**
 * GET /api/admin/video/:id — admin streams any member video from helloworldjunktest.videos.
 */
export async function getAdminVideo(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    const row = await pool.query(
      `SELECT file_extension, singles_id, video_file_name, file_path
       FROM helloworldjunktest.videos
       WHERE video_id = $1
       LIMIT 1`,
      [id]
    );

    if (row.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const { file_extension: fileExt, video_file_name: videoFileName, file_path: filePathFromDb } = row.rows[0];
    const ext = String(fileExt || 'webm').replace(/^\./, '');
    if (!getVideoFolder() && !getPhotoFolder() && !String(filePathFromDb || '').trim()) {
      return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
    }

    const fullPath = resolveVideoFilePath(null, videoFileName, id, ext, filePathFromDb);
    if (!fullPath) {
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    const resolved = path.resolve(fullPath);
    const st = fs.statSync(resolved);
    const etag = `"${st.mtimeMs}-${st.size}"`;
    res.set('ETag', etag);
    res.set('Last-Modified', st.mtime.toUTCString());
    res.set('Cache-Control', getVideoCacheControlHeaderValue());
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    const contentTypeByExt = {
      webm: 'video/webm',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg'
    };
    res.set('Content-Type', contentTypeByExt[ext] || 'application/octet-stream');
    return res.sendFile(resolved);
  } catch (error) {
    console.error('[getAdminVideo]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load video' });
  }
}
