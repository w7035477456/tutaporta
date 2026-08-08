import pool from '../../db/connection.js';
import { SELF_INTRO_VIDEO_FILE_PREFIX } from '../../utils/saveSelfIntroVideo.js';
import { resolveRequestsAppSchema } from '../singles/resolveRequestsAppSchema.js';

function isApprovedValue(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['approve', 'approved', 'true', '1', 't', 'yes', 'y'].includes(text);
}

async function resolvePhotoTypeColumn() {
  const result = await pool.query(
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

async function resolveRequestApprovalColumns(schemaName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN (
         'brief_bio_request_approval',
         'full_bio_request_approval'
       )`,
    [schemaName]
  );
  const set = new Set(result.rows.map((r) => r.column_name));
  return {
    basic: set.has('brief_bio_request_approval') ? 'brief_bio_request_approval' : null,
    detail: set.has('full_bio_request_approval') ? 'full_bio_request_approval' : null
  };
}

export async function getPublicPrivateAlbum(req, res) {
  try {
    const me = Number(req.auth?.singles_id);
    if (!Number.isFinite(me) || me < 1) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const targetSinglesId = Number(req.params.targetSinglesId);
    if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
      return res.status(400).json({ error: 'Invalid target singles id' });
    }

    const photoTypeColumn = await resolvePhotoTypeColumn();
    const photosResult = await pool.query(
      `SELECT photos_id, display_order${photoTypeColumn ? `, ${photoTypeColumn}::text AS album_type_raw` : ''}
       FROM helloworldjunktest.photos
       WHERE singles_id = $1
       ORDER BY display_order NULLS LAST, photos_id`,
      [targetSinglesId]
    );

    const publicPhotoIds = [];
    const privatePhotoIds = [];
    for (const row of photosResult.rows) {
      const id = Number(row.photos_id);
      if (!Number.isFinite(id) || id < 1) continue;
      const typeText = String(photoTypeColumn ? row.album_type_raw ?? 'uploaded' : 'public')
        .trim()
        .toLowerCase();
      if (typeText === 'private') {
        privatePhotoIds.push(id);
        continue;
      }
      if (typeText === 'deleted' || typeText === 'uploaded') continue;
      if (typeText === 'public') {
        publicPhotoIds.push(id);
      }
    }

    const videosResult = await pool.query(
      `SELECT video_id, type::text AS album_type_raw
       FROM helloworldjunktest.videos
       WHERE singles_id = $1
         AND video_file_name LIKE $2
       ORDER BY video_id`,
      [targetSinglesId, `${SELF_INTRO_VIDEO_FILE_PREFIX}%`]
    );

    const publicVideoIds = [];
    const privateVideoIds = [];
    for (const row of videosResult.rows) {
      const id = Number(row.video_id);
      if (!Number.isFinite(id) || id < 1) continue;
      const typeText = String(row.album_type_raw ?? 'deleted').trim().toLowerCase();
      if (typeText === 'private') {
        privateVideoIds.push(id);
        continue;
      }
      if (typeText === 'public') {
        publicVideoIds.push(id);
      }
    }

    let canViewPrivateAlbum = me === targetSinglesId;
    if (!canViewPrivateAlbum) {
      const requestSchema = await resolveRequestsAppSchema();
      const approvalCols = await resolveRequestApprovalColumns(requestSchema);
      if (approvalCols.basic || approvalCols.detail) {
        const selectCols = [approvalCols.basic ? `r.${approvalCols.basic} AS basic_approval` : 'NULL AS basic_approval', approvalCols.detail ? `r.${approvalCols.detail} AS detail_approval` : 'NULL AS detail_approval'].join(', ');
        const approvalResult = await pool.query(
          `SELECT ${selectCols}
           FROM ${requestSchema}.requests r
           WHERE r.singles_id_from = $1
             AND r.singles_id_to = $2
           ORDER BY COALESCE(r.updated_at, r.created_at) DESC
           LIMIT 1`,
          [me, targetSinglesId]
        );
        const latest = approvalResult.rows[0];
        // Acquaint (brief) or Buddies (full) private album access.
        canViewPrivateAlbum = isApprovedValue(latest?.basic_approval) || isApprovedValue(latest?.detail_approval);
      }
    }

    const publicMediaUrls = [
      ...publicPhotoIds.map((id) => `/api/photo/${id}`),
      ...publicVideoIds.map((id) => `/api/video/${id}`)
    ];
    const privateMediaUrls = canViewPrivateAlbum
      ? [...privatePhotoIds.map((id) => `/api/photo/${id}`), ...privateVideoIds.map((id) => `/api/video/${id}`)]
      : [];

    return res.json({
      targetSinglesId,
      canViewPrivateAlbum,
      publicCount: publicMediaUrls.length,
      privateCount: privateMediaUrls.length,
      publicImageUrls: publicMediaUrls,
      privateImageUrls: privateMediaUrls
    });
  } catch (error) {
    console.error('getPublicPrivateAlbum error:', error);
    return res.status(500).json({ error: 'Failed to load public/private album' });
  }
}
