import pool from '../../db/connection.js';
import { isAdminAuth } from '../../utils/adminAuth.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';

async function getRequestColumns(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN ('brief_bio_request', 'full_bio_request')`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function normalizeRequestState(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'requested') return 'requested';
  if (text === 'notrequested') return 'notrequested';
  return null;
}

/**
 * POST /api/requestsAboutMe/requestFlag
 * Admin only — cycle incoming brief/full bio request flags on requests rows where
 * singles_id_to = logged-in member and singles_id_from = requester.
 */
export async function toggleRequestsAboutMeRequestFlag(req, res) {
  const me = Number(req.auth?.singles_id);
  const from = Number(req.body?.singles_id_from);
  const requestType = String(req.body?.request_type ?? '').trim().toLowerCase();
  const hasBasicPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'brief_bio_request');
  const hasDetailsPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'full_bio_request');

  if (!isAdminAuth(req.auth)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(from) || from < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_from' });
  }
  if (!['basic', 'details'].includes(requestType)) {
    return res.status(400).json({ error: 'request_type must be basic or details' });
  }
  if ((requestType === 'basic' && !hasBasicPayload) || (requestType === 'details' && !hasDetailsPayload)) {
    return res.status(400).json({ error: 'Missing request flag payload' });
  }

  try {
    const schemaName = await resolveRequestsAppSchema();
    const has = await getRequestColumns(schemaName);
    const requestColumn = requestType === 'basic' ? 'brief_bio_request' : 'full_bio_request';
    if (!has.has(requestColumn)) {
      return res.status(500).json({ error: 'Request flag column is missing in database schema' });
    }

    const rawValue = requestType === 'basic' ? req.body.brief_bio_request : req.body.full_bio_request;
    const nextValue = normalizeRequestState(rawValue);
    if (nextValue == null) {
      return res.status(400).json({ error: "Request flags must be 'requested' or 'notrequested'" });
    }

    const updated = await pool.query(
      `UPDATE ${schemaName}.requests
       SET ${requestColumn} = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id_from = $2
         AND singles_id_to = $3
       RETURNING requests_id, singles_id_from, singles_id_to,
                 LOWER(BTRIM(COALESCE(brief_bio_request::text, 'notrequested'))) AS brief_bio_request,
                 LOWER(BTRIM(COALESCE(full_bio_request::text, 'notrequested'))) AS full_bio_request`,
      [nextValue, from, me]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ error: 'Request row not found' });
    }

    const row = updated.rows[0];
    return res.status(200).json({
      ok: true,
      requests_id: row.requests_id ?? null,
      singles_id_from: from,
      singles_id_to: me,
      brief_bio_request: row.brief_bio_request === 'requested' ? 'requested' : 'notrequested',
      full_bio_request: row.full_bio_request === 'requested' ? 'requested' : 'notrequested'
    });
  } catch (error) {
    console.error('toggleRequestsAboutMeRequestFlag', error);
    return res.status(500).json({ error: 'Failed to update request flag' });
  }
}
