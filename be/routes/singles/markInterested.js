import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { upsertMarkInterested } from './requestsUpsert.js';
import { parseBooleanEnumRaw, sqlBooleanEnumColumnAsBool } from '../../utils/booleanEnum.js';
import { isToolsOnlyAdminAuth } from '../../utils/adminAuth.js';

/**
 * POST /api/markInterested — authenticated user marks another single as interested.
 * Upserts requests: singles_id_from = JWT user, singles_id_to = body, interested = true.
 */
export async function markInterested(req, res) {
  const from = Number(req.auth?.singles_id);
  const toRaw = req.body?.singles_id_to ?? req.body?.singlesIdTo;
  const to = Number(toRaw);

  if (!Number.isFinite(from) || from < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (isToolsOnlyAdminAuth(req.auth)) {
    return res.status(403).json({ error: 'Admin accounts cannot use My Picks' });
  }
  if (!Number.isFinite(to) || to < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_to' });
  }
  if (from === to) {
    return res.status(400).json({ error: 'Cannot mark yourself as interested' });
  }

  try {
    const requestSchema = await resolveRequestsAppSchema();
    const quotedSchema = `"${String(requestSchema).replace(/"/g, '""')}"`;

    const target = await pool.query(`SELECT 1 FROM ${quotedSchema}.singles WHERE singles_id = $1`, [to]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await upsertMarkInterested(requestSchema, from, to);

    const verify = await pool.query(
      `SELECT requests_id, singles_id_from, singles_id_to, ${sqlBooleanEnumColumnAsBool('interested')}
       FROM ${quotedSchema}.requests
       WHERE singles_id_from = $1 AND singles_id_to = $2
       ORDER BY requests_id DESC
       LIMIT 1`,
      [from, to]
    );

    return res.status(201).json({
      ok: true,
      requests_id: verify.rows[0]?.requests_id ?? null,
      singles_id_from: from,
      singles_id_to: to,
      interested: parseBooleanEnumRaw(verify.rows[0]?.interested)
    });
  } catch (error) {
    console.error('markInterested', error);
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Interest record already exists; please refresh and try again.' });
    }
    return res.status(500).json({ error: 'Failed to save interest' });
  }
}
