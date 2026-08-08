import { deletePostingPhotosReferencingAlbumVideoId } from './deletePostingPhotosForAlbumVideo.js';
import { SELF_INTRO_VIDEO_SLOT_COLUMNS } from './selfIntroVideoSlots.js';
import { unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';

const VIDEOS_TABLE = 'helloworldjunktest.videos';
const SINGLES_TABLE = 'helloworldjunktest.singles';

/**
 * Hard-delete one member video for admin tools (any video type).
 * @returns {Promise<{ videoId: number, videoFileName: string | null, fileExtension: string | null, filePath: string | null, deletedPostingPhotos: number }>}
 */
export async function hardDeleteAdminMemberVideoInTx(client, singlesId, videoId) {
  const ownerRow = await client.query(
    `SELECT video_id, video_file_name, file_extension, file_path, video_thumbnail
     FROM ${VIDEOS_TABLE}
     WHERE video_id = $1 AND singles_id = $2
     LIMIT 1`,
    [videoId, singlesId]
  );
  if (!ownerRow.rows.length) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  const row = ownerRow.rows[0];

  for (const column of SELF_INTRO_VIDEO_SLOT_COLUMNS) {
    await client.query(
      `UPDATE ${SINGLES_TABLE}
       SET ${column} = NULL
       WHERE singles_id = $1 AND ${column} = $2`,
      [singlesId, videoId]
    );
  }

  const postingDelete = await deletePostingPhotosReferencingAlbumVideoId(client, singlesId, videoId);

  await client.query(`DELETE FROM ${VIDEOS_TABLE} WHERE video_id = $1 AND singles_id = $2`, [videoId, singlesId]);

  return {
    videoId,
    videoFileName: row.video_file_name ?? null,
    fileExtension: row.file_extension ?? null,
    filePath: row.file_path ?? null,
    videoThumbnail: row.video_thumbnail ?? null,
    deletedPostingPhotos: postingDelete.deletedPostingPhotos ?? 0
  };
}

/**
 * Hard-delete one member video (transaction + on-disk cleanup).
 */
export async function hardDeleteAdminMemberVideo(client, singlesId, videoId) {
  await client.query('BEGIN');
  let deleted;
  try {
    deleted = await hardDeleteAdminMemberVideoInTx(client, singlesId, videoId);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }

  unlinkMemberVideoFilesFromDisk({
    video_id: deleted.videoId,
    video_file_name: deleted.videoFileName,
    file_extension: deleted.fileExtension,
    file_path: deleted.filePath,
    video_thumbnail: deleted.videoThumbnail
  });

  return deleted;
}
