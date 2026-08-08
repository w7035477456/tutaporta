import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { booleanEnumCast, toBooleanEnumLabel } from '../../utils/booleanEnum.js';

/**
 * POST /api/notInterested — set interested = false for requests row
 * (singles_id_from = JWT user, singles_id_to = body).
 */
export async function notInterested(req, res) {
  const from = Number(req.auth?.singles_id);
  const toRaw = req.body?.singles_id_to ?? req.body?.singlesIdTo;
  const to = Number(toRaw);

  if (!Number.isFinite(from) || from < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(to) || to < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_to' });
  }
  if (from === to) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const requestSchema = await resolveRequestsAppSchema();
    const quotedSchema = `"${String(requestSchema).replace(/"/g, '""')}"`;
    const cast = booleanEnumCast(requestSchema);
    const result = await pool.query(
      `UPDATE ${quotedSchema}.requests
       SET interested = $3::${cast}, updated_at = CURRENT_TIMESTAMP
       WHERE singles_id_from = $1 AND singles_id_to = $2`,
      [from, to, toBooleanEnumLabel(false)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No matching interest record' });
    }

    return res.json({ ok: true, singles_id_from: from, singles_id_to: to });
  } catch (error) {
    console.error('notInterested', error);
    return res.status(500).json({ error: 'Failed to update interest' });
  }
}
