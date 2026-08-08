import { SELF_INTRO_VIDEO_FILE_PREFIX } from './saveSelfIntroVideo.js';

const SELF_INTRO_VIDEO_NAME_FILTER = `video_file_name LIKE '${SELF_INTRO_VIDEO_FILE_PREFIX}%'`;
const VIDEO_NOT_DELETED = `LOWER(COALESCE(v.type::text, 'deleted')) <> 'deleted'`;

/**
 * SQL fragment: bigint[] of self-intro video ids for a member gallery.
 * @param {string} schemaRef — e.g. helloworldjunktest or quoted schema alias used for photos
 * @param {string} singlesIdExpr — column/expression matching videos.singles_id
 * @param {{ albumType?: 'public' | 'private' | null }} [options]
 */
export function sqlGalleryVideoIdsSubquery(schemaRef, singlesIdExpr, { albumType = null } = {}) {
  const albumFilter = albumType
    ? `AND LOWER(BTRIM(COALESCE(v.type::text, ''))) = '${albumType}'`
    : `AND ${VIDEO_NOT_DELETED}`;
  return `COALESCE(
    (SELECT array_agg(v.video_id ORDER BY v.video_id)
     FROM ${schemaRef}.videos v
     WHERE v.singles_id = ${singlesIdExpr}
       AND ${SELF_INTRO_VIDEO_NAME_FILTER}
       ${albumFilter}),
    ARRAY[]::bigint[]
  )`;
}
