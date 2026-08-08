import { unlinkMemberVideoFilesFromDisk } from './videoFilePath.js';

const VIDEOS_TABLE = 'helloworldjunktest.videos';

export async function fetchVideoRowsForSinglesId(pool, singlesId) {
  const { rows } = await pool.query(
    `SELECT video_id, video_file_name, file_extension, file_path
     FROM ${VIDEOS_TABLE}
     WHERE singles_id = $1`,
    [singlesId]
  );
  return rows;
}

/**
 * @param {Array<{ video_id?: number | string, video_file_name?: string | null, file_extension?: string | null, file_path?: string | null }>} videoRows
 * @returns {{ removed: string[], videoFolder: string, rowsProcessed: number }}
 */
export function deleteVideosFromFolder(videoRows) {
  const allRemoved = new Set();
  let videoFolder = '';

  for (const row of videoRows) {
    const result = unlinkMemberVideoFilesFromDisk(row);
    videoFolder = videoFolder || result.videoFolder;
    for (const filePath of result.removed) allRemoved.add(filePath);
  }

  return {
    removed: [...allRemoved],
    videoFolder,
    rowsProcessed: videoRows.length
  };
}
