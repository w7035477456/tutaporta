/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number[]} singlesIds
 * @returns {Promise<Map<number, Array<{ photosId: number, photoFileName: string, fileExtension: string, photoType: string, createdAt: string | null }>>>}
 */
export async function loadPhotosBySinglesIds(db, singlesIds) {
  const idList = [...new Set(singlesIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id >= 1))];
  const map = new Map();
  if (!idList.length) return map;

  const { rows } = await db.query(
    `SELECT photos_id, singles_id, photo_file_name, file_extension, type::text AS photo_type, created_at
     FROM helloworldjunktest.photos
     WHERE singles_id = ANY($1::bigint[])
     ORDER BY singles_id ASC, photos_id DESC`,
    [idList]
  );

  for (const row of rows) {
    const singlesId = Number(row.singles_id);
    if (!Number.isFinite(singlesId)) continue;
    if (!map.has(singlesId)) map.set(singlesId, []);
    map.get(singlesId).push({
      photosId: Number(row.photos_id),
      photoFileName: String(row.photo_file_name ?? ''),
      fileExtension: String(row.file_extension ?? 'jpg'),
      photoType: String(row.photo_type ?? 'uploaded').trim().toLowerCase() || 'uploaded',
      createdAt: row.created_at ?? null
    });
  }

  return map;
}
