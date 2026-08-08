/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number[]} singlesIds
 * @param {{ fileNamePrefix?: string }} [options]
 * @returns {Promise<Map<number, Array<{ videoId: number, videoFileName: string, fileExtension: string, createdAt: string | null }>>>}
 */
export async function loadVideosBySinglesIds(db, singlesIds, options = {}) {
  const idList = [...new Set(singlesIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id >= 1))];
  const map = new Map();
  if (!idList.length) return map;

  const fileNamePrefix = String(options.fileNamePrefix ?? '').trim();
  const prefixFilterSql = fileNamePrefix ? ' AND video_file_name LIKE $2' : '';
  const params = fileNamePrefix ? [idList, `${fileNamePrefix}%`] : [idList];

  const { rows } = await db.query(
    `SELECT video_id, singles_id, video_file_name, file_extension, created_at, video_thumbnail
     FROM helloworldjunktest.videos
     WHERE singles_id = ANY($1::bigint[])${prefixFilterSql}
     ORDER BY singles_id ASC, video_id DESC`,
    params
  );

  for (const row of rows) {
    const singlesId = Number(row.singles_id);
    if (!Number.isFinite(singlesId)) continue;
    if (!map.has(singlesId)) map.set(singlesId, []);
    map.get(singlesId).push({
      videoId: Number(row.video_id),
      videoFileName: String(row.video_file_name ?? ''),
      fileExtension: String(row.file_extension ?? 'webm'),
      createdAt: row.created_at ?? null,
      videoThumbnail: row.video_thumbnail ? String(row.video_thumbnail) : null
    });
  }

  return map;
}

/**
 * @param {object} row
 * @param {Map<number, Array<{ videoId: number, videoFileName: string, fileExtension: string, createdAt: string | null }>>} videosBySinglesId
 */
export function mapSinglesLookupVideos(row, videosBySinglesId) {
  const singlesId = Number(row?.singles_id ?? row?.singlesId);
  if (!Number.isFinite(singlesId)) return [];
  return videosBySinglesId.get(singlesId) ?? [];
}
