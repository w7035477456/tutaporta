import pool from '../../db/connection.js';
import { parseMediaDataUrl, normalizeVideoContentType } from '../../utils/parseMediaDataUrl.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { getVideoFolder } from '../../utils/videoFilePath.js';
import { deletePriorRecord4SupportVideos, saveRecord4SupportVideo } from '../../utils/saveRecord4SupportVideo.js';

const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

/**
 * POST /api/live-face-scan/save-record4support-video
 * Body: { consent_video: data URL webm/mp4 }
 */
export async function saveRecord4SupportVideoRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const consentVideo = String(req.body?.consent_video ?? '').trim();
  if (!consentVideo) {
    return res.status(400).json({ error: 'consent_video is required' });
  }

  const parsed = parseMediaDataUrl(consentVideo);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid video data URL' });
  }
  const contentType = normalizeVideoContentType(parsed.contentType);
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Video must be WebM or MP4' });
  }

  if (!getVideoFolder() && !getPhotoFolder()) {
    return res.status(500).json({ error: 'TUTADATES_VIDEO_FOLDER or TUTADATES_PHOTO_FOLDER not configured' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const saved = await saveRecord4SupportVideo(client, singlesId, consentVideo, {
      allowedContentTypes: ALLOWED_VIDEO_TYPES,
      normalizeContentType: normalizeVideoContentType,
      maxBytes: MAX_VIDEO_BYTES
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      video_id: saved.videoId,
      video_file_name: saved.videoFileName,
      file_extension: saved.fileExtension
    });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[saveRecord4SupportVideoRoute]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to save support video' });
  } finally {
    client?.release();
  }
}

/**
 * GET /api/live-face-scan/record4support-video — latest unsent support video for current member.
 */
export async function getRecord4SupportVideoRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT video_id, video_file_name, file_extension
       FROM helloworldjunktest.videos
       WHERE singles_id = $1
         AND video_file_name LIKE 'record4support_%'
       ORDER BY video_id DESC
       LIMIT 1`,
      [singlesId]
    );

    if (!rows.length) {
      return res.json({ video: null });
    }

    const row = rows[0];
    return res.json({
      video: {
        video_id: Number(row.video_id),
        video_file_name: String(row.video_file_name ?? ''),
        file_extension: String(row.file_extension ?? 'webm')
      }
    });
  } catch (error) {
    console.error('[getRecord4SupportVideoRoute]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load support video' });
  }
}

/**
 * DELETE /api/live-face-scan/record4support-video — remove saved support video for current member.
 */
export async function deleteRecord4SupportVideoRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await deletePriorRecord4SupportVideos(client, singlesId);
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[deleteRecord4SupportVideoRoute]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to remove support video' });
  } finally {
    client?.release();
  }
}
