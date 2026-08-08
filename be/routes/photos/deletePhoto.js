import fs from 'fs';
import pool from '../../db/connection.js';
import { getPhotoFolder, unlinkMemberPhotoFilesFromDisk } from '../../utils/photoFilePath.js';
import { deletePostingPhotosReferencingAlbumPhotoId } from '../../utils/deletePostingPhotosForAlbumPhoto.js';

function logPhotoDirStats(label) {
  const folder = getPhotoFolder();
  if (!folder) {
    console.log('[deletePhoto]', label, 'VSINGLES_PHOTO_FOLDER is not set');
    return;
  }
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    console.log('[deletePhoto]', label, 'folder =', folder, 'fileCount =', files.length);
  } catch (e) {
    console.error('[deletePhoto]', label, 'failed to read folder', folder, e.message);
  }
}

/**
 * DELETE /api/myPhotos/:id
 * Auth required. Deletes the photo row for the current user, related posting_photos, and disk files.
 */
export async function deletePhoto(req, res) {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const photosId = parseInt(req.params.id, 10);
    if (Number.isNaN(photosId) || photosId < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    console.log('[deletePhoto] START', { singlesId, photosId });

    let photoFileName = null;
    let fileExtension = null;
    let photoThumbnail = null;
    let filePath = null;
    let deletedPostingPhotos = 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await client.query(
        `SELECT photo_file_name, file_extension, photo_thumbnail, file_path
         FROM helloworldjunktest.photos
         WHERE photos_id = $1 AND singles_id = $2`,
        [photosId, singlesId]
      );
      if (row.rows.length === 0) {
        await client.query('ROLLBACK');
        console.log('[deletePhoto] no row found for', { singlesId, photosId });
        return res.status(404).json({ error: 'Photo not found' });
      }

      photoFileName = row.rows[0]?.photo_file_name ?? null;
      fileExtension = row.rows[0]?.file_extension ?? null;
      photoThumbnail = row.rows[0]?.photo_thumbnail ?? null;
      filePath = row.rows[0]?.file_path ?? null;

      const postingDelete = await deletePostingPhotosReferencingAlbumPhotoId(client, singlesId, photosId);
      deletedPostingPhotos = postingDelete.deletedPostingPhotos ?? 0;

      await client.query(
        `UPDATE helloworldjunktest.singles
         SET profile_image_fk = NULL
         WHERE singles_id = $1 AND profile_image_fk = $2`,
        [singlesId, photosId]
      );

      await client.query('DELETE FROM helloworldjunktest.photos WHERE photos_id = $1 AND singles_id = $2', [
        photosId,
        singlesId
      ]);
      await client.query('COMMIT');
      console.log('[deletePhoto] deleted DB row for', { singlesId, photosId, deletedPostingPhotos });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      client.release();
    }

    const { removed, photoFolder } = unlinkMemberPhotoFilesFromDisk({
      photoFileName,
      fileExtension,
      photosId,
      photo_thumbnail: photoThumbnail,
      file_path: filePath
    });

    if (!photoFolder) {
      console.warn('[deletePhoto] VSINGLES_PHOTO_FOLDER is not set; DB row removed but no disk cleanup ran', {
        singlesId,
        photosId
      });
    } else if (removed.length === 0) {
      console.log('[deletePhoto] no files removed from disk for', { photoFolder, singlesId, photosId, photoFileName });
    } else {
      console.log('[deletePhoto] removed files from disk', { singlesId, photosId, removed });
    }

    logPhotoDirStats('after delete');
    res.status(200).json({
      ok: true,
      photos_id: photosId,
      deleted_posting_photos: deletedPostingPhotos,
      photos_cache_bust: Date.now()
    });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
}
