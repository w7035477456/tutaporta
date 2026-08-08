import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { parseAdminWipeSinglesId } from '../../utils/adminWipeBySinglesIdConfig.js';
import { hardDeleteAdminMemberPhoto } from '../../utils/hardDeleteAdminMemberPhoto.js';
import { loadPhotosBySinglesIds } from '../../utils/loadPhotosBySinglesIds.js';

/**
 * POST /api/admin/wipe-by-singles-id/photos/list
 * Body: { singlesId }
 */
export async function postAdminWipeBySinglesIdPhotosList(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }

  try {
    const photosBySinglesId = await loadPhotosBySinglesIds(pool, [singlesId]);
    const photos = photosBySinglesId.get(singlesId) ?? [];
    return res.json({
      singles_id: singlesId,
      photos,
      match_count: photos.length
    });
  } catch (err) {
    console.error('[adminWipeBySinglesIdPhotos:list]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to list photos.' });
  }
}

/**
 * POST /api/admin/wipe-by-singles-id/photos/delete
 * Body: { singlesId, photosId }
 */
export async function postAdminWipeBySinglesIdPhotoDelete(req, res) {
  const singlesId = parseAdminWipeSinglesId(req.body?.singlesId ?? req.body?.singles_id);
  const photosId = Math.trunc(Number(req.body?.photosId ?? req.body?.photos_id));
  if (!singlesId) {
    return res.status(400).json({ error: 'Valid singles_id is required.' });
  }
  if (!Number.isFinite(photosId) || photosId < 1) {
    return res.status(400).json({ error: 'Valid photos_id is required.' });
  }

  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  let client;
  try {
    client = await pool.connect();
    const deleted = await hardDeleteAdminMemberPhoto(client, singlesId, photosId);
    const photosBySinglesId = await loadPhotosBySinglesIds(client, [singlesId]);
    const photos = photosBySinglesId.get(singlesId) ?? [];

    return res.json({
      ok: true,
      singles_id: singlesId,
      photos_id: deleted.photosId,
      deleted_posting_photos: deleted.deletedPostingPhotos ?? 0,
      photos,
      match_count: photos.length
    });
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    if (status >= 500) console.error('[adminWipeBySinglesIdPhotos:delete]', err?.message ?? err);
    return res.status(status).json({ error: err?.message || 'Failed to delete photo.' });
  } finally {
    client?.release();
  }
}
