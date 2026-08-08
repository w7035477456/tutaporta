import pool from '../db/connection.js';
import { resolvePostingsSchema, canViewTargetFriendsPosts, postingVisibilityExpr, resolvePostingVisibilityColumn } from '../routes/singles/getMyPicks.js';
import { resolveRequestsAppSchema } from '../routes/singles/resolveRequestsAppSchema.js';
import { SELF_INTRO_VIDEO_FILE_PREFIX } from './saveSelfIntroVideo.js';

function isApprovedValue(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['approve', 'approved', 'true', '1', 't', 'yes', 'y'].includes(text);
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

async function canViewPrivateAlbumVideo(viewerSinglesId, ownerSinglesId) {
  const requestSchema = await resolveRequestsAppSchema();
  const approvalCols = await resolveRequestApprovalColumns(requestSchema);
  if (!approvalCols.basic && !approvalCols.detail) return false;
  const selectCols = [
    approvalCols.basic ? `r.${approvalCols.basic} AS basic_approval` : 'NULL AS basic_approval',
    approvalCols.detail ? `r.${approvalCols.detail} AS detail_approval` : 'NULL AS detail_approval'
  ].join(', ');
  const result = await pool.query(
    `SELECT ${selectCols}
     FROM ${requestSchema}.requests r
     WHERE r.singles_id_from = $1
       AND r.singles_id_to = $2
     ORDER BY COALESCE(r.updated_at, r.created_at) DESC
     LIMIT 1`,
    [viewerSinglesId, ownerSinglesId]
  );
  const row = result.rows[0];
  return isApprovedValue(row?.basic_approval) || isApprovedValue(row?.detail_approval);
}

async function canViewAlbumVideo(viewerSinglesId, videoId, videoOwnerSinglesId) {
  const { rows } = await pool.query(
    `SELECT type::text AS album_type_raw, video_file_name
     FROM helloworldjunktest.videos
     WHERE video_id = $1
       AND singles_id = $2
     LIMIT 1`,
    [videoId, videoOwnerSinglesId]
  );
  const row = rows[0];
  if (!row) return false;
  const fileName = String(row.video_file_name ?? '');
  if (!fileName.startsWith(SELF_INTRO_VIDEO_FILE_PREFIX)) return false;
  const albumType = String(row.album_type_raw ?? 'deleted').trim().toLowerCase();
  if (albumType === 'public') return true;
  if (albumType === 'private') {
    return canViewPrivateAlbumVideo(viewerSinglesId, videoOwnerSinglesId);
  }
  return false;
}

/**
 * Owner always; others when video is on a visible posting or in public/private album they may view.
 * @param {number} viewerSinglesId
 * @param {number} videoId
 * @param {number} videoOwnerSinglesId
 */
export async function canViewerAccessMemberVideo(viewerSinglesId, videoId, videoOwnerSinglesId) {
  if (Number(viewerSinglesId) === Number(videoOwnerSinglesId)) return true;
  if (!Number.isFinite(viewerSinglesId) || viewerSinglesId < 1) return false;
  if (!Number.isFinite(videoId) || videoId < 1) return false;
  if (!Number.isFinite(videoOwnerSinglesId) || videoOwnerSinglesId < 1) return false;

  const postingsSchema = await resolvePostingsSchema();
  const postingVisibilityColumn = await resolvePostingVisibilityColumn(postingsSchema);
  const visibilityExpr = postingVisibilityExpr(postingVisibilityColumn, 'p');
  const requestSchema = await resolveRequestsAppSchema();
  const canViewFriends = await canViewTargetFriendsPosts(requestSchema, viewerSinglesId, videoOwnerSinglesId);

  const videoUrlNeedle = `/api/video/${videoId}`;
  const { rows } = await pool.query(
    `SELECT 1
     FROM ${postingsSchema}.posting_photos pp
     INNER JOIN ${postingsSchema}.postings p ON p.post_id = pp.post_id
     WHERE p.singles_id = $1
       AND (
         pp.photo_url = $2
         OR pp.photo_url LIKE $3
       )
       AND (
         ${visibilityExpr} = 'public'
         OR (${visibilityExpr} = 'friends' AND $4::boolean)
         OR p.singles_id = $5
       )
     LIMIT 1`,
    [videoOwnerSinglesId, videoUrlNeedle, `%${videoUrlNeedle}%`, canViewFriends, viewerSinglesId]
  );

  if (rows.length > 0) return true;
  return canViewAlbumVideo(viewerSinglesId, videoId, videoOwnerSinglesId);
}
