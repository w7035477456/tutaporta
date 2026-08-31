import pool from '../../db/connection.js';
import { allocateRequestsId } from './requestsUpsert.js';
import {
  booleanEnumCast,
  parseBooleanEnumRaw,
  sqlBooleanEnumColumnAsBool,
  sqlBooleanEnumSelectAsBool,
  toBooleanEnumLabel
} from '../../utils/booleanEnum.js';
import { isAdminAuth } from '../../utils/adminAuth.js';
import { sqlApprovalStatusParam } from '../../utils/pgEnumTypes.js';
import { normalizeApprovalStatus } from '../../utils/approvalStatusEnum.js';
import { clearBioRequestNotificationDismissed } from './bioRequestNotifications.js';
import { sendBioRequestNotificationEmailFireAndForget } from '../../lib/bioRequestNotificationEmail.js';
import { isSinglesStatusActive } from '../../utils/singlesStatus.js';
import { appendBioRequestHardCopyFromIds } from '../../utils/hardCopyBioRequestLog.js';

async function resolveAppSchema() {
  const result = await pool.query(
    `SELECT table_schema
     FROM information_schema.tables
     WHERE table_name = 'requests'
       AND table_schema IN ('helloworldjunktest', 'public')
     ORDER BY CASE WHEN table_schema = 'helloworldjunktest' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return result.rows[0]?.table_schema || 'public';
}

async function getRequestColumns(schemaName) {
  const cols = await pool.query(
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
        'full_approval_date'
      )`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function quoteSchema(schemaName) {
  return `"${String(schemaName).replace(/"/g, '""')}"`;
}

function normalizeRequestState(value) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (text === 'requested') return 'requested';
  if (text === 'notrequested') return 'notrequested';
  return null;
}

function normalizeApprovalValue(value) {
  return normalizeApprovalStatus(value);
}

/**
 * POST /api/interested/requestInfo
 * Upserts a requests row for (singles_id_from, singles_id_to) and sets:
 * - brief_bio_request
 * - full_bio_request
 * Always keeps interested = true for entries managed from Interested / Picks pages.
 */
export async function toggleInterestedRequestInfo(req, res) {
  const from = Number(req.auth?.singles_id);
  const to = Number(req.body?.singles_id_to ?? req.body?.singlesIdTo);
  const hasBasicPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'brief_bio_request');
  const hasDetailsPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'full_bio_request');
  const hasBasicApprovalPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'brief_bio_request_approval');
  const hasDetailsApprovalPayload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'full_bio_request_approval');

  if (!Number.isFinite(from) || from < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(to) || to < 1) {
    return res.status(400).json({ error: 'Invalid singles_id_to' });
  }
  if (from === to) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!hasBasicPayload && !hasDetailsPayload && !hasBasicApprovalPayload && !hasDetailsApprovalPayload) {
    return res.status(400).json({ error: 'No request toggle provided' });
  }
  if ((hasBasicApprovalPayload || hasDetailsApprovalPayload) && !isAdminAuth(req.auth)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const schemaName = await resolveAppSchema();
    const quotedSchema = quoteSchema(schemaName);
    const target = await pool.query(`SELECT status FROM ${quotedSchema}.singles WHERE singles_id = $1 LIMIT 1`, [to]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    // Sending new bio requests only allowed to Active members (approvals may still update existing rows).
    if ((hasBasicPayload || hasDetailsPayload) && !isSinglesStatusActive(target.rows[0]?.status)) {
      return res.status(404).json({ error: 'Member is not available' });
    }

    const requestColumns = await getRequestColumns(schemaName);
    const basicColumnName = requestColumns.has('brief_bio_request') ? 'brief_bio_request' : null;
    const supportsBasic = Boolean(basicColumnName);
    const detailsColumnName = requestColumns.has('full_bio_request') ? 'full_bio_request' : null;
    const supportsDetails = Boolean(detailsColumnName);

    if ((hasBasicPayload && !supportsBasic) || (hasDetailsPayload && !supportsDetails)) {
      return res.status(500).json({ error: 'Request columns are missing in database schema' });
    }

    const basic = hasBasicPayload ? normalizeRequestState(req.body.brief_bio_request) : null;
    const details = hasDetailsPayload ? normalizeRequestState(req.body.full_bio_request) : null;
    if ((hasBasicPayload && basic == null) || (hasDetailsPayload && details == null)) {
      return res.status(400).json({ error: "Request flags must be 'requested' or 'notrequested'" });
    }

    const basicApprovalColumn = requestColumns.has('brief_bio_request_approval') ? 'brief_bio_request_approval' : null;
    const fullApprovalColumn = requestColumns.has('full_bio_request_approval') ? 'full_bio_request_approval' : null;
    const basicApproval = hasBasicApprovalPayload ? normalizeApprovalValue(req.body.brief_bio_request_approval) : null;
    const fullApproval = hasDetailsApprovalPayload ? normalizeApprovalValue(req.body.full_bio_request_approval) : null;
    if ((hasBasicApprovalPayload && basicApproval == null) || (hasDetailsApprovalPayload && fullApproval == null)) {
      return res.status(400).json({ error: "Approval flags must be 'approve', 'deny', or 'noresponse'" });
    }
    if ((hasBasicApprovalPayload && !basicApprovalColumn) || (hasDetailsApprovalPayload && !fullApprovalColumn)) {
      return res.status(500).json({ error: 'Request approval columns are missing in database schema' });
    }

    const cast = booleanEnumCast(schemaName);
    const interestedTrue = toBooleanEnumLabel(true);

    let previousBrief = 'notrequested';
    let previousFull = 'notrequested';
    if ((hasBasicPayload && basic === 'requested') || (hasDetailsPayload && details === 'requested')) {
      const prevCols = [];
      if (supportsBasic) prevCols.push(`LOWER(BTRIM(COALESCE(${basicColumnName}::text, 'notrequested'))) AS brief_bio_request`);
      if (supportsDetails) prevCols.push(`LOWER(BTRIM(COALESCE(${detailsColumnName}::text, 'notrequested'))) AS full_bio_request`);
      if (prevCols.length) {
        const prevResult = await pool.query(
          `SELECT ${prevCols.join(', ')}
           FROM ${quotedSchema}.requests
           WHERE singles_id_from = $1 AND singles_id_to = $2
           LIMIT 1`,
          [from, to]
        );
        const prevRow = prevResult.rows[0] ?? {};
        previousBrief = prevRow.brief_bio_request === 'requested' ? 'requested' : 'notrequested';
        previousFull = prevRow.full_bio_request === 'requested' ? 'requested' : 'notrequested';
      }
    }

    const updateParts = [`interested = $3::${cast}`, 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [from, to, interestedTrue];

    if (hasBasicPayload && supportsBasic) {
      updateParams.push(basic);
      updateParts.push(`${basicColumnName} = $${updateParams.length}`);
    }

    if (hasDetailsPayload && supportsDetails) {
      updateParams.push(details);
      updateParts.push(`${detailsColumnName} = $${updateParams.length}`);
    }

    if (hasBasicApprovalPayload && basicApprovalColumn) {
      updateParams.push(basicApproval);
      updateParts.push(`${basicApprovalColumn} = ${sqlApprovalStatusParam(`$${updateParams.length}`, schemaName)}`);
      if (requestColumns.has('brief_approval_date')) {
        updateParts.push(
          basicApproval === 'approve'
            ? 'brief_approval_date = CURRENT_DATE'
            : 'brief_approval_date = NULL'
        );
      }
    }

    if (hasDetailsApprovalPayload && fullApprovalColumn) {
      updateParams.push(fullApproval);
      updateParts.push(`${fullApprovalColumn} = ${sqlApprovalStatusParam(`$${updateParams.length}`, schemaName)}`);
      if (requestColumns.has('full_approval_date')) {
        updateParts.push(
          fullApproval === 'approve' ? 'full_approval_date = CURRENT_DATE' : 'full_approval_date = NULL'
        );
      }
    }

    const updated = await pool.query(
      `UPDATE ${quotedSchema}.requests
       SET ${updateParts.join(', ')}
       WHERE singles_id_from = $1 AND singles_id_to = $2`,
      updateParams
    );

    if (updated.rowCount === 0) {
      const requestsId = await allocateRequestsId(schemaName, quotedSchema);
      const insertColumns = ['requests_id', 'singles_id_from', 'singles_id_to', 'interested'];
      const insertValues = ['$1', '$2', '$3', `$4::${cast}`];
      const insertParams = [requestsId, from, to, interestedTrue];

      if (hasBasicPayload && supportsBasic) {
        insertParams.push(basic);
        insertColumns.push(basicColumnName);
        insertValues.push(`$${insertParams.length}`);
      }

      if (hasDetailsPayload && supportsDetails) {
        insertParams.push(details);
        insertColumns.push(detailsColumnName);
        insertValues.push(`$${insertParams.length}`);
      }

      try {
        await pool.query(
          `INSERT INTO ${quotedSchema}.requests (${insertColumns.join(', ')})
           VALUES (${insertValues.join(', ')})`,
          insertParams
        );
      } catch (insertErr) {
        if (insertErr?.code !== '23505') throw insertErr;
        const retry = await pool.query(
          `UPDATE ${quotedSchema}.requests
           SET ${updateParts.join(', ')}
           WHERE singles_id_from = $1 AND singles_id_to = $2`,
          updateParams
        );
        if (retry.rowCount === 0) throw insertErr;
      }
    }

    const readCols = [];
    if (supportsBasic) readCols.push(`LOWER(BTRIM(COALESCE(${basicColumnName}::text, 'notrequested'))) AS brief_bio_request`);
    if (supportsDetails) readCols.push(`LOWER(BTRIM(COALESCE(${detailsColumnName}::text, 'notrequested'))) AS full_bio_request`);
    if (basicApprovalColumn) readCols.push(`${basicApprovalColumn} AS brief_bio_request_approval`);
    if (fullApprovalColumn) readCols.push(`${fullApprovalColumn} AS full_bio_request_approval`);
    readCols.push(sqlBooleanEnumColumnAsBool('interested'));
    const readResult = await pool.query(
      `SELECT ${readCols.join(', ')}
       FROM ${quotedSchema}.requests
       WHERE singles_id_from = $1 AND singles_id_to = $2
       LIMIT 1`,
      [from, to]
    );

    const row = readResult.rows[0] ?? {};
    const briefNewlyRequested = hasBasicPayload && basic === 'requested' && previousBrief !== 'requested';
    const fullNewlyRequested = hasDetailsPayload && details === 'requested' && previousFull !== 'requested';
    if (briefNewlyRequested || fullNewlyRequested) {
      try {
        await clearBioRequestNotificationDismissed(to, from);
      } catch (clearErr) {
        console.warn('toggleInterestedRequestInfo clearBioRequestNotificationDismissed', clearErr?.message ?? clearErr);
      }
      sendBioRequestNotificationEmailFireAndForget({
        requesterSinglesId: from,
        recipientSinglesId: to,
        briefRequested: briefNewlyRequested,
        fullRequested: fullNewlyRequested
      });
      if (briefNewlyRequested) {
        void appendBioRequestHardCopyFromIds(req, {
          requesterId: from,
          requesteeId: to,
          bioKind: 'brief'
        });
      }
      if (fullNewlyRequested) {
        void appendBioRequestHardCopyFromIds(req, {
          requesterId: from,
          requesteeId: to,
          bioKind: 'full'
        });
      }
    }

    return res.status(200).json({
      ok: true,
      singles_id_from: from,
      singles_id_to: to,
      interested: parseBooleanEnumRaw(row.interested),
      brief_bio_request: row.brief_bio_request === 'requested' ? 'requested' : 'notrequested',
      full_bio_request: row.full_bio_request === 'requested' ? 'requested' : 'notrequested',
      brief_bio_request_approval: row.brief_bio_request_approval ?? null,
      full_bio_request_approval: row.full_bio_request_approval ?? null
    });
  } catch (error) {
    console.error('toggleInterestedRequestInfo', error);
    return res.status(500).json({ error: 'Failed to update request toggles' });
  }
}
