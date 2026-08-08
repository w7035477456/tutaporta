import { deletePostingPhotosReferencingAlbumPhotoId } from './deletePostingPhotosForAlbumPhoto.js';
import { unlinkMemberPhotoFilesFromDisk } from './photoFilePath.js';

const PHOTOS_TABLE = 'helloworldjunktest.photos';
const SINGLES_TABLE = 'helloworldjunktest.singles';

/**
 * Hard-delete one member photo for admin tools (any photo type).
 * @returns {Promise<{ photosId: number, photoFileName: string | null, fileExtension: string | null, deletedPostingPhotos: number }>}
 */
export async function hardDeleteAdminMemberPhotoInTx(client, singlesId, photosId) {
  const ownerRow = await client.query(
    `SELECT photos_id, photo_file_name, file_extension, photo_thumbnail, file_path
     FROM ${PHOTOS_TABLE}
     WHERE photos_id = $1 AND singles_id = $2
     LIMIT 1`,
    [photosId, singlesId]
  );
  if (!ownerRow.rows.length) {
    const err = new Error('Photo not found');
    err.statusCode = 404;
    throw err;
  }

  const row = ownerRow.rows[0];

  await client.query(
    `UPDATE helloworldjunktest.consent_record
     SET consent_signature_image_fk = NULL
     WHERE consent_signature_image_fk = $1`,
    [photosId]
  );

  await client.query(
    `UPDATE ${SINGLES_TABLE}
     SET profile_image_fk = NULL
     WHERE singles_id = $1 AND profile_image_fk = $2`,
    [singlesId, photosId]
  );

  const postingDelete = await deletePostingPhotosReferencingAlbumPhotoId(client, singlesId, photosId);

  await client.query(`DELETE FROM ${PHOTOS_TABLE} WHERE photos_id = $1 AND singles_id = $2`, [photosId, singlesId]);

  return {
    photosId,
    photoFileName: row.photo_file_name ?? null,
    fileExtension: row.file_extension ?? null,
    photoThumbnail: row.photo_thumbnail ?? null,
    filePath: row.file_path ?? null,
    deletedPostingPhotos: postingDelete.deletedPostingPhotos ?? 0
  };
}

/**
 * Hard-delete one member photo (transaction + on-disk cleanup).
 */
export async function hardDeleteAdminMemberPhoto(client, singlesId, photosId) {
  await client.query('BEGIN');
  let deleted;
  try {
    deleted = await hardDeleteAdminMemberPhotoInTx(client, singlesId, photosId);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }

  unlinkMemberPhotoFilesFromDisk({
    photoFileName: deleted.photoFileName,
    fileExtension: deleted.fileExtension,
    photosId: deleted.photosId,
    photo_thumbnail: deleted.photoThumbnail,
    file_path: deleted.filePath
  });

  return deleted;
}
