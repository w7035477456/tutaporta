import pool from '../../db/connection.js';
import { parseApprovalStayDurationDays } from '../../utils/approvalStayDurationConfig.js';
import { isApprovalLockedDuringStay } from '../../utils/requestApprovalStay.js';
import { sqlApprovalStatusParam } from '../../utils/pgEnumTypes.js';
import { normalizeApprovalStatus, APPROVAL_STATUS_APPROVE, APPROVAL_STATUS_DENY } from '../../utils/approvalStatusEnum.js';
import { booleanEnumCast, toBooleanEnumLabel } from '../../utils/booleanEnum.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { allocateRequestsId } from './requestsUpsert.js';
import {
  approvalTypeToBioKind,
  clearBioResponseNotificationDismissed
} from './bioResponseNotifications.js';

async function getRequestColumns(schemaName, client = pool) {
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
         'interested'
       )`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function normalizeApprovalValue(value) {
  return normalizeApprovalStatus(value);
}

function quoteSchema(schemaName) {
  return `"${String(schemaName).replace(/"/g, '""')}"`;
}

/**
 * Mutual buddy/acquaintance: when B approves A's bio request, ensure B→A outgoing row
 * exists with the same request+approval so B also sees A on Acquaint. & Buddies.
 * Does not set paid flags — viewer still pays tokens to unlock bio view.
 */
async function ensureMutualApprovedOutgoingRequest(
  schemaName,
  has,
  { approverId, requesterId, approvalType },
  client = pool
) {
  const requestCol = approvalType === 'basic' ? 'brief_bio_request' : 'full_bio_request';
  const approvalCol = approvalType === 'basic' ? 'brief_bio_request_approval' : 'full_bio_request_approval';
  if (!has.has(requestCol) || !has.has(approvalCol)) return;

  const quotedSchema = quoteSchema(schemaName);
  const approvalDateCol =
    approvalType === 'basic'
      ? has.has('brief_approval_date')
        ? 'brief_approval_date'
        : null
      : has.has('full_approval_date')
        ? 'full_approval_date'
        : null;

  const updateParts = [
    `${requestCol} = 'requested'`,
    `${approvalCol} = ${sqlApprovalStatusParam('$3', schemaName)}`,
    'updated_at = CURRENT_TIMESTAMP'
  ];
  const updateParams = [approverId, requesterId, APPROVAL_STATUS_APPROVE];

  if (has.has('interested')) {
    const cast = booleanEnumCast(schemaName);
    updateParams.push(toBooleanEnumLabel(true));
    updateParts.push(`interested = $${updateParams.length}::${cast}`);
  }
  if (approvalDateCol) {
    updateParts.push(`${approvalDateCol} = CURRENT_DATE`);
  }

  const updated = await client.query(
    `UPDATE ${quotedSchema}.requests
     SET ${updateParts.join(', ')}
     WHERE singles_id_from = $1 AND singles_id_to = $2`,
    updateParams
  );
  if (updated.rowCount > 0) return;

  const requestsId = await allocateRequestsId(schemaName, quotedSchema, client);
  const insertColumns = ['requests_id', 'singles_id_from', 'singles_id_to', requestCol, approvalCol];
  const insertValues = ['$1', '$2', '$3', `'requested'`, sqlApprovalStatusParam('$4', schemaName)];
  const insertParams = [requestsId, approverId, requesterId, APPROVAL_STATUS_APPROVE];

  if (has.has('interested')) {
    const cast = booleanEnumCast(schemaName);
    insertParams.push(toBooleanEnumLabel(true));
    insertColumns.push('interested');
    insertValues.push(`$${insertParams.length}::${cast}`);
  }
  if (approvalDateCol) {
    insertColumns.push(approvalDateCol);
    insertValues.push('CURRENT_DATE');
  }

  try {
    await client.query(
      `INSERT INTO ${quotedSchema}.requests (${insertColumns.join(', ')})
       VALUES (${insertValues.join(', ')})`,
      insertParams
    );
  } catch (insertErr) {
    if (insertErr?.code !== '23505') throw insertErr;
    const retry = await client.query(
      `UPDATE ${quotedSchema}.requests
       SET ${updateParts.join(', ')}
       WHERE singles_id_from = $1 AND singles_id_to = $2`,
      updateParams
    );
    if (retry.rowCount === 0) throw insertErr;
  }
}

export async function toggleRequestApprovalAboutMe(req, res) {
  const me = Number(req.auth?.singles_id);
  const from = Number(req.body?.singles_id_from);
  const approvalType = String(req.body?.approval_type ?? '').trim().toLowerCase();
  const nextApproval = normalizeApprovalValue(req.body?.approval);

  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(from) || from < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_from' });
  }
  if (!['basic', 'details'].includes(approvalType)) {
    return res.status(400).json({ error: 'approval_type must be basic or details' });
  }
  if (nextApproval === null) {
    return res.status(400).json({ error: "approval must be 'approve', 'deny', or 'noresponse'" });
  }

  const client = await pool.connect();
  try {
    const schemaName = await resolveRequestsAppSchema();
    const has = await getRequestColumns(schemaName, client);
    const stayDays = parseApprovalStayDurationDays();

    const basicRequestCol = has.has('brief_bio_request') ? 'brief_bio_request' : null;
    const basicApprovalCol = has.has('brief_bio_request_approval') ? 'brief_bio_request_approval' : null;
    const fullBioRequestCol = has.has('full_bio_request') ? 'full_bio_request' : null;
    const fullBioApprovalCol = has.has('full_bio_request_approval') ? 'full_bio_request_approval' : null;

    const requestedColumn = approvalType === 'basic' ? basicRequestCol : fullBioRequestCol;
    const approvalColumn = approvalType === 'basic' ? basicApprovalCol : fullBioApprovalCol;
    if (!requestedColumn || !approvalColumn) {
      return res.status(500).json({ error: 'Request approval columns are missing in database schema' });
    }

    const approvalDateCols = [
      has.has('brief_approval_date') ? 'brief_approval_date' : null,
      has.has('full_approval_date') ? 'full_approval_date' : null
    ]
      .filter(Boolean)
      .join(', ');

    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT requests_id,
              ${approvalColumn} AS current_approval
              ${approvalDateCols ? `, ${approvalDateCols}` : ''}
       FROM ${schemaName}.requests
       WHERE singles_id_from = $1
         AND singles_id_to = $2
         AND LOWER(BTRIM(COALESCE(${requestedColumn}::text, 'notrequested'))) = 'requested'
       LIMIT 1
       FOR UPDATE`,
      [from, me]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found or not enabled for this approval type' });
    }

    const currentRow = existing.rows[0];
    const currentApproval = normalizeApprovalValue(currentRow.current_approval);
    const approvalDate =
      approvalType === 'basic' ? currentRow.brief_approval_date : currentRow.full_approval_date;

    if (
      isApprovalLockedDuringStay({
        approvalValue: currentApproval,
        approvalDate,
        stayDays
      }) &&
      nextApproval !== currentApproval
    ) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Approval response is locked during the configured stay duration after consent was submitted.'
      });
    }

    const setBriefApprovalDate =
      has.has('brief_approval_date') && approvalType === 'basic' && nextApproval === 'approve';
    const setFullApprovalDate =
      has.has('full_approval_date') && approvalType === 'details' && nextApproval === 'approve';

    const updated = await client.query(
      `UPDATE ${schemaName}.requests
       SET ${approvalColumn} = ${sqlApprovalStatusParam('$1', schemaName)},
           updated_at = CURRENT_TIMESTAMP${
             setBriefApprovalDate ? ',\n           brief_approval_date = CURRENT_DATE' : ''
           }${
             setFullApprovalDate ? ',\n           full_approval_date = CURRENT_DATE' : ''
           }
       WHERE singles_id_from = $2
         AND singles_id_to = $3
       RETURNING requests_id, singles_id_from, singles_id_to, ${approvalColumn} AS approval_value${
         has.has('brief_approval_date') ? ', brief_approval_date' : ''
       }${has.has('full_approval_date') ? ', full_approval_date' : ''}`,
      [nextApproval, from, me]
    );

    if (nextApproval === APPROVAL_STATUS_APPROVE) {
      await ensureMutualApprovedOutgoingRequest(
        schemaName,
        has,
        {
          approverId: me,
          requesterId: from,
          approvalType
        },
        client
      );
    }

    await client.query('COMMIT');

    if (nextApproval === APPROVAL_STATUS_APPROVE || nextApproval === APPROVAL_STATUS_DENY) {
      try {
        await clearBioResponseNotificationDismissed(from, me, approvalTypeToBioKind(approvalType));
      } catch (clearErr) {
        console.warn('toggleRequestApprovalAboutMe clearBioResponseNotificationDismissed', clearErr?.message ?? clearErr);
      }
    }

    return res.status(200).json({
      ok: true,
      requests_id: updated.rows[0]?.requests_id ?? null,
      singles_id_from: from,
      singles_id_to: me,
      approval_type: approvalType,
      approval: updated.rows[0]?.approval_value ?? nextApproval,
      brief_approval_date: updated.rows[0]?.brief_approval_date ?? null,
      full_approval_date: updated.rows[0]?.full_approval_date ?? null
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('toggleRequestApprovalAboutMe', error);
    return res.status(500).json({ error: 'Failed to update request approval' });
  } finally {
    client.release();
  }
}
