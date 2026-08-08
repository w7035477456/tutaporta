import pool from '../../db/connection.js';
import { resolveBioSchema, sqlIdent } from './checkrBioReviewDb.js';

/**
 * GET /api/consent-record/list
 * Returns consent_record rows for the logged-in member.
 */
export async function getConsentRecords(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const schemaName = await resolveBioSchema();
    const schema = sqlIdent(schemaName);

    const result = await pool.query(
      `SELECT
         cr.consent_record_id,
         cr.date_signed,
         cr.viewer_approved,
         cr.consent_signature_image_fk,
         cr.consent_signature_video_fk,
         cr.description,
         vs.prefix AS viewer_prefix,
         vs.member_id AS viewer_member_id,
         vs.alias AS viewer_nickname
       FROM ${schema}.consent_record cr
       LEFT JOIN helloworldjunktest.singles vs ON vs.singles_id = cr.viewer_approved
       WHERE cr.member_id = $1
       ORDER BY cr.date_signed DESC, cr.consent_record_id DESC`,
      [singlesId]
    );

    return res.json({
      rows: result.rows.map((row) => ({
        consent_record_id: row.consent_record_id,
        date_signed: row.date_signed,
        viewer_approved: row.viewer_approved,
        consent_signature_image_fk: row.consent_signature_image_fk,
        consent_signature_video_fk: row.consent_signature_video_fk,
        description: row.description ?? null,
        viewer_prefix: row.viewer_prefix ?? null,
        viewer_member_id: row.viewer_member_id ?? null,
        viewer_nickname: row.viewer_nickname ?? null
      }))
    });
  } catch (error) {
    console.error('[consent:getConsentRecords]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load consent records' });
  }
}
