import { SELF_INTRO_VIDEO_FILE_PREFIX } from './saveSelfIntroVideo.js';
import { SELF_INTRO_VIDEO_SLOT_COLUMNS, loadSelfIntroVideoSlotRow } from './selfIntroVideoSlots.js';
import { deletePostingPhotosReferencingAlbumVideoId } from './deletePostingPhotosForAlbumVideo.js';
import { unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';

const VIDEOS_TABLE = 'helloworldjunktest.videos';
const SINGLES_TABLE = 'helloworldjunktest.singles';

/**
 * Hard-delete one self-intro video inside an open transaction (DB only).
 * @returns {Promise<{ videoId: number, videoFileName: string | null, fileExtension: string | null, filePath: string | null, deletedPostingPhotos: number }>}
 */
export async function hardDeleteMemberSelfIntroVideoInTx(client, singlesId, videoId) {
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
  const fileName = String(row.video_file_name ?? '');
  if (!fileName.startsWith(SELF_INTRO_VIDEO_FILE_PREFIX)) {
    const err = new Error('Only self intro videos can be deleted');
    err.statusCode = 400;
    throw err;
  }

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

export function unlinkDeletedSelfIntroVideoFiles(deletedRows) {
  for (const row of Array.isArray(deletedRows) ? deletedRows : []) {
    unlinkMemberVideoFilesFromDisk({
      video_id: row.videoId,
      video_file_name: row.videoFileName,
      file_extension: row.fileExtension,
      file_path: row.filePath,
      video_thumbnail: row.videoThumbnail
    });
  }
}

/**
 * Hard-delete one self-intro video (transaction + on-disk cleanup).
 */
export async function hardDeleteMemberSelfIntroVideo(client, singlesId, videoId) {
  await client.query('BEGIN');
  let deleted;
  try {
    deleted = await hardDeleteMemberSelfIntroVideoInTx(client, singlesId, videoId);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }

  unlinkDeletedSelfIntroVideoFiles([deleted]);
  return deleted;
}

/**
 * Remove self-intro video rows that are not assigned to any singles slot (transaction only).
 * @returns {Promise<Array<{ videoId: number, videoFileName: string | null, fileExtension: string | null, filePath: string | null }>>}
 */
export async function purgeOrphanSelfIntroVideosInTx(client, singlesId) {
  const slotRow = await loadSelfIntroVideoSlotRow(client, singlesId);
  const slottedIds = new Set(
    SELF_INTRO_VIDEO_SLOT_COLUMNS.map((column) => Number(slotRow[column])).filter((id) => Number.isFinite(id) && id > 0)
  );

  const { rows } = await client.query(
    `SELECT video_id
     FROM ${VIDEOS_TABLE}
     WHERE singles_id = $1
       AND video_file_name LIKE $2
     ORDER BY video_id ASC`,
    [singlesId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`]
  );

  const purged = [];
  for (const row of rows) {
    const videoId = Number(row.video_id);
    if (!Number.isFinite(videoId) || videoId < 1 || slottedIds.has(videoId)) continue;
    const deleted = await hardDeleteMemberSelfIntroVideoInTx(client, singlesId, videoId);
    purged.push(deleted);
  }

  return purged;
}
