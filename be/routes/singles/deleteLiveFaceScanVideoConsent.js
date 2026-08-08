import pool from '../../db/connection.js';
import { resolveBioSchema, sqlIdent } from './checkrBioReviewDb.js';
import { deleteLiveFaceScanVideoConsentsForMember } from '../../utils/deleteLiveFaceScanVideoConsents.js';

/**
 * DELETE /api/consent-record/live-face-scan-video
 */
export async function deleteLiveFaceScanVideoConsent(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let client;
  try {
    const schemaName = await resolveBioSchema();
    const schema = sqlIdent(schemaName);
    client = await pool.connect();
    await client.query('BEGIN');
    await deleteLiveFaceScanVideoConsentsForMember(client, schema, singlesId);
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[consent:deleteLiveFaceScanVideoConsent]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to delete live face scan video' });
  } finally {
    client?.release();
  }
}
