import { SELF_INTRO_VIDEO_FILE_PREFIX } from './saveSelfIntroVideo.js';

export const ALBUM_MEDIA_MAX = 10;
export const PUBLIC_VIDEO_ALBUM_MAX = 3;

/** Member My Album sections — no soft-delete bucket. */
export const VALID_ALBUM_TYPES = new Set(['uploaded', 'public', 'private']);

export async function resolvePhotoAlbumTypeColumn(client) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'photos'
       AND column_name IN ('type', 'photo_type', 'album_type')
     ORDER BY CASE column_name
       WHEN 'type' THEN 0
       WHEN 'photo_type' THEN 1
       ELSE 2
     END
     LIMIT 1`
  );
  return result.rows[0]?.column_name || null;
}

/** Count photos already in an album type. */
export async function countAlbumPhotosInType(client, singlesId, albumType, { excludePhotoId = null } = {}) {
  const photoTypeColumn = await resolvePhotoAlbumTypeColumn(client);
  if (!photoTypeColumn) return 0;
  const photoResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM helloworldjunktest.photos
     WHERE singles_id = $1
       AND ($2::bigint IS NULL OR photos_id <> $2)
       AND LOWER(COALESCE(${photoTypeColumn}::text, 'uploaded')) = $3`,
    [singlesId, excludePhotoId, albumType]
  );
  return Number(photoResult.rows[0]?.count || 0);
}

/** Count self-intro videos already in an album type. */
export async function countAlbumVideosInType(client, singlesId, albumType, { excludeVideoId = null } = {}) {
  const videoResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM helloworldjunktest.videos
     WHERE singles_id = $1
       AND ($2::bigint IS NULL OR video_id <> $2)
       AND video_file_name LIKE $3
       AND LOWER(type::text) = $4`,
    [singlesId, excludeVideoId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`, albumType]
  );
  return Number(videoResult.rows[0]?.count || 0);
}

/** Count photos + self-intro videos already in an album type (shared 10-item cap). */
export async function countAlbumMediaInType(
  client,
  singlesId,
  albumType,
  { excludePhotoId = null, excludeVideoId = null } = {}
) {
  const photoTypeColumn = await resolvePhotoAlbumTypeColumn(client);
  let photoCount = 0;
  if (photoTypeColumn) {
    const photoResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM helloworldjunktest.photos
       WHERE singles_id = $1
         AND ($2::bigint IS NULL OR photos_id <> $2)
         AND LOWER(COALESCE(${photoTypeColumn}::text, 'uploaded')) = $3`,
      [singlesId, excludePhotoId, albumType]
    );
    photoCount = Number(photoResult.rows[0]?.count || 0);
  }

  const videoResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM helloworldjunktest.videos
     WHERE singles_id = $1
       AND ($2::bigint IS NULL OR video_id <> $2)
       AND video_file_name LIKE $3
       AND LOWER(type::text) = $4`,
    [singlesId, excludeVideoId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`, albumType]
  );
  const videoCount = Number(videoResult.rows[0]?.count || 0);
  return photoCount + videoCount;
}
