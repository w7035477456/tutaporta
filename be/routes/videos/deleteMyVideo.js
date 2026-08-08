import pool from '../../db/connection.js';
import { hardDeleteMemberSelfIntroVideo } from '../../utils/hardDeleteMemberSelfIntroVideo.js';

/**
 * DELETE /api/myVideos/:id
 * Hard-delete a self-intro video (DB row, posting refs, on-disk file).
 */
export async function deleteMyVideo(req, res) {
  let client;
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) return res.status(401).json({ error: 'Authentication required' });

    const videoId = parseInt(req.params.id, 10);
    if (Number.isNaN(videoId) || videoId < 1) {
      return res.status(400).json({ error: 'Invalid video id' });
    }

    client = await pool.connect();
    const deleted = await hardDeleteMemberSelfIntroVideo(client, singlesId, videoId);

    return res.status(200).json({
      ok: true,
      video_id: videoId,
      deleted_posting_photos: deleted.deletedPostingPhotos ?? 0
    });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    if (status >= 500) console.error('deleteMyVideo error:', err);
    return res.status(status).json({ error: err?.message || 'Failed to delete video' });
  } finally {
    client?.release();
  }
}
