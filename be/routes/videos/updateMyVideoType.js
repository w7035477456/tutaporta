import pool from '../../db/connection.js';
import { sqlPhotoTypeParam } from '../../utils/pgEnumTypes.js';
import { SELF_INTRO_VIDEO_FILE_PREFIX } from '../../utils/saveSelfIntroVideo.js';
import {
  ALBUM_MEDIA_MAX,
  PUBLIC_VIDEO_ALBUM_MAX,
  VALID_ALBUM_TYPES,
  countAlbumVideosInType
} from '../../utils/albumMediaCapacity.js';

const DEFAULT_FULL_ERROR = 'Full error message';

/**
 * PATCH /api/myVideos/:id/type
 * Move a self-intro video between album sections (shared 10-item cap with photos).
 */
export async function updateMyVideoType(req, res) {
  let client;
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) return res.status(401).json({ error: 'Authentication required' });

    const videoId = parseInt(req.params.id, 10);
    if (Number.isNaN(videoId) || videoId < 1) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    const targetType = String(req.body?.type ?? '').trim().toLowerCase();
    if (!VALID_ALBUM_TYPES.has(targetType)) {
      return res.status(400).json({
        error:
          targetType === 'deleted'
            ? 'Videos cannot be soft-deleted. Use delete to remove the video and its file permanently.'
            : 'Invalid video type'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const ownerRow = await client.query(
      `SELECT video_id, type::text AS album_type_raw, video_file_name
       FROM helloworldjunktest.videos
       WHERE video_id = $1 AND singles_id = $2
       LIMIT 1`,
      [videoId, singlesId]
    );
    if (!ownerRow.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Video not found' });
    }

    const row = ownerRow.rows[0];
    const fileName = String(row.video_file_name ?? '');
    if (!fileName.startsWith(SELF_INTRO_VIDEO_FILE_PREFIX)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only self intro videos can be moved between albums' });
    }

    const currentType = String(row.album_type_raw ?? 'deleted').trim().toLowerCase();
    if (currentType === targetType) {
      await client.query('COMMIT');
      return res.json({ ok: true, video_id: videoId, type: targetType });
    }

    const videoCap = targetType === 'public' ? PUBLIC_VIDEO_ALBUM_MAX : ALBUM_MEDIA_MAX;
    const destinationCount = await countAlbumVideosInType(client, singlesId, targetType, { excludeVideoId: videoId });
    if (destinationCount >= videoCap) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: DEFAULT_FULL_ERROR });
    }

    await client.query(`UPDATE helloworldjunktest.videos SET type = ${sqlPhotoTypeParam('$1')} WHERE video_id = $2`, [
      targetType,
      videoId
    ]);
    await client.query('COMMIT');
    return res.json({ ok: true, video_id: videoId, type: targetType });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        // ignore rollback failure
      }
    }
    console.error('updateMyVideoType error:', err);
    return res.status(500).json({ error: 'Failed to update video type' });
  } finally {
    client?.release();
  }
}
