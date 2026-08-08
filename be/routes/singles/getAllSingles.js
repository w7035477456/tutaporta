import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { sqlInterestedIsTrue } from './interestedSql.js';
import { buildSinglesVisibilityWhereSql } from './memberVisibility.js';
import { sqlGalleryVideoIdsSubquery } from '../../utils/galleryMediaSql.js';
import { isToolsOnlyAdminAuth } from '../../utils/adminAuth.js';

async function buildSinglesVettedExpr() {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'singles'
       AND column_name IN ('vetted_basic_status', 'vetted_basic_status')`
  );
  const has = new Set(cols.rows.map((r) => r.column_name));
  if (has.has('vetted_basic_status')) {
    return 's.vetted_basic_status AS vetted_basic_status';
  }
  if (has.has('vetted_basic_status')) {
    return "LOWER(COALESCE(s.vetted_basic_status::text, '')) = 'vetted' AS vetted_basic_status";
  }
  return 'false AS vetted_basic_status';
}

export async function getAllSingles(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const vettedExpr = await buildSinglesVettedExpr();
    const requestSchema = await resolveRequestsAppSchema();
    const quotedSchema = `"${String(requestSchema).replace(/"/g, '""')}"`;
    const toolsOnlyAdmin = isToolsOnlyAdminAuth(req.auth);

    let result;
    if (toolsOnlyAdmin) {
      result = await pool.query(
        `SELECT s.singles_id, s.prefix, s.member_id, s.profile_image_fk,
           COALESCE(NULLIF(TRIM(s.alias), ''), NULLIF(TRIM(split_part(s.email, '@', 1)), '')) AS alias,
           ${vettedExpr},
           COALESCE(
             (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
              FROM ${quotedSchema}.photos p
              WHERE p.singles_id = s.singles_id),
             ARRAY[]::bigint[]
           ) AS gallery_photo_ids,
           ${sqlGalleryVideoIdsSubquery(quotedSchema, 's.singles_id')} AS gallery_video_ids
         FROM ${quotedSchema}.singles s
         ORDER BY s.created_at DESC`
      );
    } else {
      const visibility = buildSinglesVisibilityWhereSql('s', 2);
      result = await pool.query(
        `SELECT s.singles_id, s.prefix, s.member_id, s.profile_image_fk,
           COALESCE(NULLIF(TRIM(s.alias), ''), NULLIF(TRIM(split_part(s.email, '@', 1)), '')) AS alias,
           ${vettedExpr},
           COALESCE(
             (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
              FROM ${quotedSchema}.photos p
              WHERE p.singles_id = s.singles_id),
             ARRAY[]::bigint[]
           ) AS gallery_photo_ids,
           ${sqlGalleryVideoIdsSubquery(quotedSchema, 's.singles_id')} AS gallery_video_ids
         FROM ${quotedSchema}.singles s
         WHERE s.singles_id <> $1
           AND ${visibility.whereSql}
           AND NOT EXISTS (
             SELECT 1
             FROM ${quotedSchema}.requests r
             WHERE r.singles_id_from = $1
               AND r.singles_id_to = s.singles_id
               AND ${sqlInterestedIsTrue('r')}
           )
         ORDER BY s.created_at DESC`,
        [me, ...visibility.params]
      );
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching singles:', error);
    res.status(500).json({ error: 'Failed to fetch singles from database' });
  }
}
