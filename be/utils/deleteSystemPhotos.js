import { unlinkMemberPhotoFilesFromDisk, isSystemPhotoFileName } from './photoFilePath.js';
import { unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';

export { isSystemPhotoFileName };

/**
 * Hard-delete prior system photos for one singles_id + filename prefix (replace flow).
 * Clears consent_record.consent_signature_image_fk before delete.
 */
export async function deletePriorSystemPhotosByPrefix(client, singlesId, fileNamePrefix) {
  const prefix = String(fileNamePrefix ?? '').trim();
  if (!prefix) return 0;

  const { rows } = await client.query(
    `SELECT photos_id, photo_file_name, file_extension
     FROM helloworldjunktest.photos
     WHERE singles_id = $1
       AND photo_file_name LIKE $2`,
    [singlesId, `${prefix}%`]
  );

  let removed = 0;
  for (const row of rows) {
    const photosId = Number(row.photos_id);
    await client.query(
      `UPDATE helloworldjunktest.consent_record
       SET consent_signature_image_fk = NULL
       WHERE consent_signature_image_fk = $1`,
      [photosId]
    );
    await client.query(`DELETE FROM helloworldjunktest.photos WHERE photos_id = $1 AND singles_id = $2`, [
      photosId,
      singlesId
    ]);
    unlinkMemberPhotoFilesFromDisk({
      photoFileName: row.photo_file_name,
      fileExtension: row.file_extension,
      photosId
    });
    removed += 1;
  }

  return removed;
}

/**
 * Hard-delete one photos row + disk file; clears consent FK when present.
 */
export async function hardDeletePhotoRow(client, row) {
  const photosId = Number(row.photos_id ?? row.photosId);
  const singlesId = Number(row.singles_id ?? row.singlesId);
  if (!Number.isFinite(photosId) || photosId < 1) return false;

  await client.query(
    `UPDATE helloworldjunktest.consent_record
     SET consent_signature_image_fk = NULL
     WHERE consent_signature_image_fk = $1`,
    [photosId]
  );
  if (Number.isFinite(singlesId) && singlesId > 0) {
    await client.query(
      `UPDATE helloworldjunktest.singles SET profile_image_fk = NULL WHERE singles_id = $1 AND profile_image_fk = $2`,
      [singlesId, photosId]
    );
    await client.query(`DELETE FROM helloworldjunktest.photos WHERE photos_id = $1 AND singles_id = $2`, [
      photosId,
      singlesId
    ]);
  } else {
    await client.query(`DELETE FROM helloworldjunktest.photos WHERE photos_id = $1`, [photosId]);
  }

  unlinkMemberPhotoFilesFromDisk({
    photoFileName: row.photo_file_name ?? row.photoFileName,
    fileExtension: row.file_extension ?? row.fileExtension,
    photosId
  });
  return true;
}

/**
 * Purge every photos/videos row still using type = deleted (legacy + system).
 */
export async function purgeAllDeletedTypeMedia(client) {
  let purgedPhotos = 0;
  let purgedVideos = 0;

  const photoRows = await client.query(
    `SELECT photos_id, singles_id, photo_file_name, file_extension
     FROM helloworldjunktest.photos
     WHERE LOWER(COALESCE(type::text, 'uploaded')) = 'deleted'`
  );

  for (const row of photoRows.rows) {
    if (await hardDeletePhotoRow(client, row)) purgedPhotos += 1;
  }

  const videoRows = await client.query(
    `SELECT video_id, singles_id, video_file_name, file_extension, file_path, video_thumbnail
     FROM helloworldjunktest.videos
     WHERE LOWER(type::text) = 'deleted'`
  );

  for (const row of videoRows.rows) {
    const videoId = Number(row.video_id);
    const singlesId = Number(row.singles_id);
    await client.query(
      `UPDATE helloworldjunktest.consent_record
       SET consent_signature_video_fk = NULL
       WHERE consent_signature_video_fk = $1`,
      [videoId]
    );
    await client.query(`DELETE FROM helloworldjunktest.videos WHERE video_id = $1 AND singles_id = $2`, [
      videoId,
      singlesId
    ]);
    unlinkMemberVideoFilesFromDisk(row);
    purgedVideos += 1;
  }

  return { purgedPhotos, purgedVideos };
}
