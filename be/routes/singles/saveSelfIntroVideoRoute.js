import pool from '../../db/connection.js';
import { parseMediaDataUrl, normalizeVideoContentType } from '../../utils/parseMediaDataUrl.js';
import { getPhotoFolder } from '../../utils/photoFilePath.js';
import { getVideoFolder } from '../../utils/videoFilePath.js';
import { saveSelfIntroVideo, SELF_INTRO_VIDEO_MAX_BYTES, PUBLIC_VAULT_UPLOAD_MAX_BYTES } from '../../utils/saveSelfIntroVideo.js';
import { unlinkDeletedSelfIntroVideoFiles } from '../../utils/hardDeleteMemberSelfIntroVideo.js';
import { isAdminImpersonationSession } from '../../utils/adminAuth.js';

const ALLOWED_VIDEO_TYPES = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'audio/mpeg'
]);

/**
 * POST /api/self-intro-video/save
 * Body: { intro_video: data URL, vault_file_upload?: boolean }
 */
export async function saveSelfIntroVideoRoute(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const introVideo = String(req.body?.intro_video ?? req.body?.consent_video ?? '').trim();
  if (!introVideo) {
    return res.status(400).json({ error: 'intro_video is required' });
  }

  const parsed = parseMediaDataUrl(introVideo);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid video data URL' });
  }
  const contentType = normalizeVideoContentType(parsed.contentType);
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return res.status(400).json({
      error: 'File must be mp3, mp4, webm, mov, avi, or wmv'
    });
  }

  const vaultFileUpload = req.body?.vault_file_upload === true;
  const skipUploadSizeLimit = isAdminImpersonationSession(req.auth);
  const maxBytes = skipUploadSizeLimit
    ? Number.MAX_SAFE_INTEGER
    : vaultFileUpload
      ? PUBLIC_VAULT_UPLOAD_MAX_BYTES
      : SELF_INTRO_VIDEO_MAX_BYTES;

  if (!getVideoFolder() && !getPhotoFolder()) {
    return res.status(500).json({ error: 'VSINGLES_VIDEO_FOLDER or VSINGLES_PHOTO_FOLDER not configured' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const saved = await saveSelfIntroVideo(client, singlesId, introVideo, {
      allowedContentTypes: ALLOWED_VIDEO_TYPES,
      normalizeContentType: normalizeVideoContentType,
      maxBytes
    });

    await client.query('COMMIT');
    unlinkDeletedSelfIntroVideoFiles(saved.purgedOrphans);

    return res.json({
      success: true,
      video_id: saved.videoId,
      video_file_name: saved.videoFileName,
      file_extension: saved.fileExtension,
      slot: saved.slot,
      slot_column: saved.slotColumn
    });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[saveSelfIntroVideoRoute]', error?.message || error);
    if (error?.code === 'DUPLICATE_UPLOAD') {
      return res.status(409).json({ code: 'DUPLICATE_UPLOAD', error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'Failed to save self intro video' });
  } finally {
    client?.release();
  }
}
