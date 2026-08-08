import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { parseAdminWipeSinglesId } from '../../utils/adminWipeBySinglesIdConfig.js';
import { hardDeleteAdminMemberVideo } from '../../utils/hardDeleteAdminMemberVideo.js';
import { loadVideosBySinglesIds } from '../../utils/loadVideosBySinglesIds.js';

/**
 * POST /api/admin/wipe-by-singles-id/videos/list
 * Body: { singlesId }
 */
export async function postAdminWipeBySinglesIdVideosList(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }

  try {
    const videosBySinglesId = await loadVideosBySinglesIds(pool, [singlesId]);
    const videos = videosBySinglesId.get(singlesId) ?? [];
    return res.json({
      singles_id: singlesId,
      videos,
      match_count: videos.length
    });
  } catch (err) {
    console.error('[adminWipeBySinglesIdVideos:list]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to list videos.' });
  }
}

/**
 * POST /api/admin/wipe-by-singles-id/videos/delete
 * Body: { singlesId, videoId }
 */
export async function postAdminWipeBySinglesIdVideoDelete(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  const videoId = Math.trunc(Number(req.body?.videoId ?? req.body?.video_id));
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }
  if (!Number.isFinite(videoId) || videoId < 1) {
    return res.status(400).json({ error: 'Valid video_id is required.' });
  }

  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  let client;
  try {
    client = await pool.connect();
    const deleted = await hardDeleteAdminMemberVideo(client, singlesId, videoId);
    const videosBySinglesId = await loadVideosBySinglesIds(client, [singlesId]);
    const videos = videosBySinglesId.get(singlesId) ?? [];

    return res.json({
      ok: true,
      singles_id: singlesId,
      video_id: deleted.videoId,
      deleted_posting_photos: deleted.deletedPostingPhotos ?? 0,
      videos,
      match_count: videos.length
    });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    if (status >= 500) console.error('[adminWipeBySinglesIdVideos:delete]', err?.message ?? err);
    return res.status(status).json({ error: err?.message || 'Failed to delete video.' });
  } finally {
    client?.release();
  }
}
