import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { booleanEnumCast, toBooleanEnumLabel } from '../../utils/booleanEnum.js';
import { sqlApprovalStatusParam } from '../../utils/pgEnumTypes.js';
import { APPROVAL_STATUS_NO_RESPONSE } from '../../utils/approvalStatusEnum.js';
import {
  REQUESTS_BRIEF_PAID_COLUMN,
  REQUESTS_FULL_PAID_COLUMN,
  REQUESTS_BRIEF_PAID_DATE_COLUMN,
  REQUESTS_FULL_PAID_DATE_COLUMN,
  REQUESTS_BRIEF_PAID_ENTRY_COLUMN,
  REQUESTS_FULL_PAID_ENTRY_COLUMN
} from '../../utils/requestsPaidColumns.js';

function quoteSchema(schemaName) {
  return `"${String(schemaName).replace(/"/g, '""')}"`;
}

async function getRequestColumns(schemaName, client) {
  const cols = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN (
         'brief_bio_request',
         'full_bio_request',
         'brief_bio_request_approval',
         'full_bio_request_approval',
         'brief_approval_date',
         'full_approval_date',
         '${REQUESTS_BRIEF_PAID_COLUMN}',
         '${REQUESTS_FULL_PAID_COLUMN}',
         '${REQUESTS_BRIEF_PAID_DATE_COLUMN}',
         '${REQUESTS_FULL_PAID_DATE_COLUMN}',
         '${REQUESTS_BRIEF_PAID_ENTRY_COLUMN}',
         '${REQUESTS_FULL_PAID_ENTRY_COLUMN}'
       )`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function buildClearRelationshipSetSql(schemaName, has) {
  const parts = ['updated_at = CURRENT_TIMESTAMP'];
  const params = [];
  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (has.has('brief_bio_request')) {
    parts.push(`brief_bio_request = ${pushParam('notrequested')}`);
  }
  if (has.has('full_bio_request')) {
    parts.push(`full_bio_request = ${pushParam('notrequested')}`);
  }
  if (has.has('brief_bio_request_approval')) {
    const ref = pushParam(APPROVAL_STATUS_NO_RESPONSE);
    parts.push(`brief_bio_request_approval = ${sqlApprovalStatusParam(ref, schemaName)}`);
  }
  if (has.has('full_bio_request_approval')) {
    const ref = pushParam(APPROVAL_STATUS_NO_RESPONSE);
    parts.push(`full_bio_request_approval = ${sqlApprovalStatusParam(ref, schemaName)}`);
  }
  if (has.has('brief_approval_date')) {
    parts.push('brief_approval_date = NULL');
  }
  if (has.has('full_approval_date')) {
    parts.push('full_approval_date = NULL');
  }

  const paidFalse = toBooleanEnumLabel(false);
  const paidCast = booleanEnumCast(schemaName);
  if (has.has(REQUESTS_BRIEF_PAID_COLUMN)) {
    const ref = pushParam(paidFalse);
    parts.push(`${REQUESTS_BRIEF_PAID_COLUMN} = ${ref}::${paidCast}`);
  }
  if (has.has(REQUESTS_FULL_PAID_COLUMN)) {
    const ref = pushParam(paidFalse);
    parts.push(`${REQUESTS_FULL_PAID_COLUMN} = ${ref}::${paidCast}`);
  }
  if (has.has(REQUESTS_BRIEF_PAID_DATE_COLUMN)) {
    parts.push(`${REQUESTS_BRIEF_PAID_DATE_COLUMN} = NULL`);
  }
  if (has.has(REQUESTS_FULL_PAID_DATE_COLUMN)) {
    parts.push(`${REQUESTS_FULL_PAID_DATE_COLUMN} = NULL`);
  }
  if (has.has(REQUESTS_BRIEF_PAID_ENTRY_COLUMN)) {
    parts.push(`${REQUESTS_BRIEF_PAID_ENTRY_COLUMN} = NULL`);
  }
  if (has.has(REQUESTS_FULL_PAID_ENTRY_COLUMN)) {
    parts.push(`${REQUESTS_FULL_PAID_ENTRY_COLUMN} = NULL`);
  }

  return { parts, params };
}

/**
 * POST /api/requestedSingles/remove
 * Clear mutual Acquaintance / Buddy request+approval (both directions).
 * Leaves `interested` unchanged so the person can remain on My Picks.
 */
export async function removeRequestedFriend(req, res) {
  const from = Number(req.auth?.singles_id);
  const to = Number(req.body?.singles_id_to ?? req.body?.singlesIdTo);

  if (!Number.isFinite(from) || from < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(to) || to < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_to' });
  }
  if (from === to) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const client = await pool.connect();
  try {
    const schemaName = await resolveRequestsAppSchema();
    const quotedSchema = quoteSchema(schemaName);
    const has = await getRequestColumns(schemaName, client);
    const { parts, params } = buildClearRelationshipSetSql(schemaName, has);
    if (parts.length <= 1) {
      return res.status(500).json({ error: 'Request columns are missing in database schema' });
    }

    await client.query('BEGIN');
    const outgoing = await client.query(
      `UPDATE ${quotedSchema}.requests
       SET ${parts.join(', ')}
       WHERE singles_id_from = $${params.length + 1} AND singles_id_to = $${params.length + 2}`,
      [...params, from, to]
    );
    if (outgoing.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No matching acquaintance or buddy record' });
    }
    await client.query(
      `UPDATE ${quotedSchema}.requests
       SET ${parts.join(', ')}
       WHERE singles_id_from = $${params.length + 1} AND singles_id_to = $${params.length + 2}`,
      [...params, to, from]
    );
    await client.query('COMMIT');

    return res.json({ ok: true, singles_id_from: from, singles_id_to: to });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('removeRequestedFriend', error);
    return res.status(500).json({ error: 'Failed to remove acquaintance or buddy' });
  } finally {
    client.release();
  }
}
