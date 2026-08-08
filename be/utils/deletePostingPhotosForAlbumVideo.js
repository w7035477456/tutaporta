import { relationExists, resolvePostingsSchema } from '../routes/singles/getMyPicks.js';

/**
 * Remove posting_photos rows that point at a deleted album video (/api/video/:videoId).
 * Also removes posting_comments on those posting photos.
 */
export async function deletePostingPhotosReferencingAlbumVideoId(client, singlesId, videoId) {
  const postingsSchema = await resolvePostingsSchema();
  const hasPostingPhotos = await relationExists(postingsSchema, 'posting_photos');
  if (!hasPostingPhotos) return { deletedPostingPhotos: 0 };

  const videoIdText = String(videoId);
  const postingPhotoRows = await client.query(
    `SELECT pp.photo_id
     FROM ${postingsSchema}.posting_photos pp
     INNER JOIN ${postingsSchema}.postings p ON p.post_id = pp.post_id
     WHERE p.singles_id = $1
       AND pp.photo_url ~ ('/api/video/' || $2::text || '([?#].*)?$')`,
    [singlesId, videoIdText]
  );
  const postingPhotoIds = postingPhotoRows.rows
    .map((row) => Number(row.photo_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!postingPhotoIds.length) return { deletedPostingPhotos: 0 };

  const hasPostingComments = await relationExists(postingsSchema, 'posting_comments');
  if (hasPostingComments) {
    await client.query(`DELETE FROM ${postingsSchema}.posting_comments WHERE photo_id = ANY($1::bigint[])`, [
      postingPhotoIds
    ]);
  }

  const deleted = await client.query(
    `DELETE FROM ${postingsSchema}.posting_photos pp
     USING ${postingsSchema}.postings p
     WHERE pp.post_id = p.post_id
       AND p.singles_id = $1
       AND pp.photo_url ~ ('/api/video/' || $2::text || '([?#].*)?$')`,
    [singlesId, videoIdText]
  );

  return { deletedPostingPhotos: deleted.rowCount ?? 0 };
}
