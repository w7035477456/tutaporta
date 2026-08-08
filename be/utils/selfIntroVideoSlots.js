export const SELF_INTRO_VIDEO_SLOT_COLUMNS = ['video1_fk', 'video2_fk', 'video3_fk'];

export const SELF_INTRO_VIDEO_SLOT_COUNT = SELF_INTRO_VIDEO_SLOT_COLUMNS.length;

/**
 * @param {{ video1_fk?: unknown, video2_fk?: unknown, video3_fk?: unknown }} row
 */
export function countFilledSelfIntroVideoSlots(row) {
  return SELF_INTRO_VIDEO_SLOT_COLUMNS.reduce((count, column) => {
    const id = Number(row?.[column]);
    return count + (Number.isFinite(id) && id > 0 ? 1 : 0);
  }, 0);
}

/**
 * @param {{ video1_fk?: unknown, video2_fk?: unknown, video3_fk?: unknown }} row
 */
export function allSelfIntroVideoSlotsFull(row) {
  return countFilledSelfIntroVideoSlots(row) >= SELF_INTRO_VIDEO_SLOT_COUNT;
}

/**
 * @param {{ video1_fk?: unknown, video2_fk?: unknown, video3_fk?: unknown }} row
 * @returns {string | null}
 */
export function firstEmptySelfIntroVideoSlotColumn(row) {
  for (const column of SELF_INTRO_VIDEO_SLOT_COLUMNS) {
    const id = Number(row?.[column]);
    if (!Number.isFinite(id) || id < 1) return column;
  }
  return null;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 */
export async function loadSelfIntroVideoSlotRow(client, singlesId) {
  const { rows } = await client.query(
    `SELECT video1_fk, video2_fk, video3_fk
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return rows[0] ?? { video1_fk: null, video2_fk: null, video3_fk: null };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 * @returns {Promise<Array<{ slot: number, column: string, videoId: number | null, videoFileName: string | null, fileExtension: string | null, createdAt: string | null }>>}
 */
export async function loadSelfIntroVideoSlots(client, singlesId) {
  const slotRow = await loadSelfIntroVideoSlotRow(client, singlesId);
  const videoIds = SELF_INTRO_VIDEO_SLOT_COLUMNS.map((column) => {
    const id = Number(slotRow[column]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }).filter(Boolean);

  const videoById = new Map();
  if (videoIds.length) {
    const { rows } = await client.query(
      `SELECT video_id, video_file_name, file_extension, created_at, video_thumbnail
       FROM helloworldjunktest.videos
       WHERE video_id = ANY($1::bigint[])
         AND singles_id = $2`,
      [videoIds, singlesId]
    );
    for (const row of rows) {
      videoById.set(Number(row.video_id), row);
    }
  }

  return SELF_INTRO_VIDEO_SLOT_COLUMNS.map((column, index) => {
    const videoIdRaw = Number(slotRow[column]);
    const videoId = Number.isFinite(videoIdRaw) && videoIdRaw > 0 ? videoIdRaw : null;
    const videoRow = videoId != null ? videoById.get(videoId) : null;
    return {
      slot: index + 1,
      column,
      videoId,
      videoFileName: videoRow ? String(videoRow.video_file_name ?? '') : null,
      fileExtension: videoRow ? String(videoRow.file_extension ?? 'webm') : null,
      createdAt: videoRow?.created_at ?? null,
      videoThumbnail: videoRow?.video_thumbnail ? String(videoRow.video_thumbnail) : null
    };
  });
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 * @param {number} videoId
 * @returns {Promise<{ slot: number, column: string }>}
 */
export async function assignSelfIntroVideoToFirstEmptySlot(client, singlesId, videoId) {
  const slotRow = await loadSelfIntroVideoSlotRow(client, singlesId);
  const column = firstEmptySelfIntroVideoSlotColumn(slotRow);
  if (!column) {
    throw new Error('All three self intro video slots are full. Remove one before saving a new video.');
  }

  await client.query(`UPDATE helloworldjunktest.singles SET ${column} = $1 WHERE singles_id = $2`, [videoId, singlesId]);

  return { slot: SELF_INTRO_VIDEO_SLOT_COLUMNS.indexOf(column) + 1, column };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} singlesId
 * @param {number} slotNumber 1..3
 */
export async function clearSelfIntroVideoSlot(client, singlesId, slotNumber) {
  const column = SELF_INTRO_VIDEO_SLOT_COLUMNS[slotNumber - 1];
  if (!column) {
    throw new Error('Invalid self intro video slot');
  }
  await client.query(`UPDATE helloworldjunktest.singles SET ${column} = NULL WHERE singles_id = $1`, [singlesId]);
  return { slot: slotNumber, column };
}
