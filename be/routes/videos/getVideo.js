import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { canViewerAccessMemberVideo } from '../../utils/canViewerAccessMemberVideo.js';
import { getVideoFolder, resolveVideoFilePath } from '../../utils/videoFilePath.js';
import { recordPhotoCacheResult } from '../../utils/photoCacheStats.js';

function getClientIp(req) {
  return (
    req.ip ||
    (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : '') ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

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
 * GET /api/video/:id — authenticated member may stream own videos only.
 */
export async function getVideo(req, res) {
  try {
    const authSinglesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(authSinglesId) || authSinglesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

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

    const { file_extension: fileExt, singles_id: videoOwnerId, video_file_name: videoFileName, file_path: filePathFromDb } =
      row.rows[0];
    if (Number(videoOwnerId) !== authSinglesId) {
      const allowed = await canViewerAccessMemberVideo(authSinglesId, id, Number(videoOwnerId));
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const ext = String(fileExt || 'webm').replace(/^\./, '');
    if (!getVideoFolder() && !getPhotoFolder() && !String(filePathFromDb || '').trim()) {
      return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
    }

    const fullPath = resolveVideoFilePath(null, videoFileName, id, ext, filePathFromDb);
    if (!fullPath) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const resolved = path.resolve(fullPath);
    const st = fs.statSync(resolved);
    const etag = `"${st.mtimeMs}-${st.size}"`;
    res.set('ETag', etag);
    res.set('Last-Modified', st.mtime.toUTCString());
    res.set('Cache-Control', getVideoCacheControlHeaderValue());
    if (req.headers['if-none-match'] === etag) {
      res.set('X-Video-Cache', 'HIT');
      void recordPhotoCacheResult(getClientIp(req), true, id);
      return res.status(304).end();
    }

    const contentTypeByExt = {
      webm: 'video/webm',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
      mp3: 'audio/mpeg'
    };
    res.set('Content-Type', contentTypeByExt[ext] || 'application/octet-stream');
    res.set('X-Video-Cache', 'MISS');
    void recordPhotoCacheResult(getClientIp(req), false, id);
    return res.sendFile(resolved);
  } catch (error) {
    console.error('Error serving video:', error);
    return res.status(500).json({ error: 'Failed to load video' });
  }
}
