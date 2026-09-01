import path from 'path';
import fs from 'fs';
import pool from '../../db/connection.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { canViewerAccessMemberVideo } from '../../utils/canViewerAccessMemberVideo.js';
import { resolveVideoThumbnailPath } from '../../utils/videoThumbnailPath.js';
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

async function loadVideoThumbnailRow(videoId) {
  const row = await pool.query(
    `SELECT video_thumbnail, singles_id, file_path
     FROM helloworldjunktest.videos
     WHERE video_id = $1
     LIMIT 1`,
    [videoId]
  );
  return row.rows[0] ?? null;
}

function sendThumbnailFile(req, res, fullPath, cacheId) {
  const resolved = path.resolve(fullPath);
  const st = fs.statSync(resolved);
  const etag = `"${st.mtimeMs}-${st.size}"`;
  res.set('ETag', etag);
  res.set('Last-Modified', st.mtime.toUTCString());
  res.set('Cache-Control', getVideoCacheControlHeaderValue());
  res.set('Content-Type', 'image/jpeg');
  if (req.headers['if-none-match'] === etag) {
    res.set('X-Video-Cache', 'HIT');
    void recordPhotoCacheResult(getClientIp(req), true, cacheId);
    return res.status(304).end();
  }
  res.set('X-Video-Cache', 'MISS');
  void recordPhotoCacheResult(getClientIp(req), false, cacheId);
  return res.sendFile(resolved);
}

/**
 * GET /api/video/:id/thumbnail — JPEG thumbnail (play icon baked in).
 */
export async function getVideoThumbnail(req, res) {
  try {
    const authSinglesId = Number(req.auth?.singles_id);
    if (!Number.isFinite(authSinglesId) || authSinglesId < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    const dbRow = await loadVideoThumbnailRow(id);
    if (!dbRow) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoOwnerId = Number(dbRow.singles_id);
    if (videoOwnerId !== authSinglesId) {
      const allowed = await canViewerAccessMemberVideo(authSinglesId, id, videoOwnerId);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (!getPhotoFolder() && !String(dbRow.file_path || '').trim()) {
      return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
    }

    const fullPath = resolveVideoThumbnailPath(dbRow.video_thumbnail, dbRow.file_path);
    if (!fullPath) {
      return res.status(404).json({ error: 'Video thumbnail not found' });
    }

    return sendThumbnailFile(req, res, fullPath, id);
  } catch (error) {
    console.error('[getVideoThumbnail]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load video thumbnail' });
  }
}

/**
 * GET /api/admin/video/:id/thumbnail — admin JPEG thumbnail.
 */
export async function getAdminVideoThumbnail(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    const dbRow = await loadVideoThumbnailRow(id);
    if (!dbRow) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (!getPhotoFolder() && !String(dbRow.file_path || '').trim()) {
      return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
    }

    const fullPath = resolveVideoThumbnailPath(dbRow.video_thumbnail, dbRow.file_path);
    if (!fullPath) {
      return res.status(404).json({ error: 'Video thumbnail not found' });
    }

    return sendThumbnailFile(req, res, fullPath, id);
  } catch (error) {
    console.error('[getAdminVideoThumbnail]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load video thumbnail' });
  }
}
