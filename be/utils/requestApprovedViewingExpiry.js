import { parseApprovedViewingDurationMonths } from './approvedViewingDurationConfig.js';
import { sqlBooleanEnumLiteral } from './booleanEnum.js';
import {
  REQUESTS_BRIEF_PAID_COLUMN,
  REQUESTS_BRIEF_PAID_DATE_COLUMN,
  REQUESTS_BRIEF_PAID_ENTRY_COLUMN,
  REQUESTS_FULL_PAID_COLUMN,
  REQUESTS_FULL_PAID_DATE_COLUMN,
  REQUESTS_FULL_PAID_ENTRY_COLUMN
} from './requestsPaidColumns.js';

async function getExpiryColumns(pool, schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function briefViewingExpiredCondition(viewingMonths) {
  return `(
    LOWER(BTRIM(COALESCE(brief_bio_request_approval::text, ''))) IN ('approve', 'approved')
    AND brief_approval_date IS NOT NULL
    AND (brief_approval_date + make_interval(months => ${Number(viewingMonths)}::int))::date <= CURRENT_DATE
  )`;
}

function fullViewingExpiredCondition(viewingMonths) {
  return `(
    LOWER(BTRIM(COALESCE(full_bio_request_approval::text, ''))) IN ('approve', 'approved')
    AND full_approval_date IS NOT NULL
    AND (full_approval_date + make_interval(months => ${Number(viewingMonths)}::int))::date <= CURRENT_DATE
  )`;
}

function buildExpirySetClauses(has, schemaName, briefExpire, fullExpire, canExpireBrief, canExpireFull) {
  const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
  const falsePaid = sqlBooleanEnumLiteral(false, schemaName);

  const briefPaidCol = has.has(REQUESTS_BRIEF_PAID_COLUMN) ? REQUESTS_BRIEF_PAID_COLUMN : null;
  const briefPaidDateCol = has.has(REQUESTS_BRIEF_PAID_DATE_COLUMN) ? REQUESTS_BRIEF_PAID_DATE_COLUMN : null;
  const briefPaidEntryCol = has.has(REQUESTS_BRIEF_PAID_ENTRY_COLUMN) ? REQUESTS_BRIEF_PAID_ENTRY_COLUMN : null;
  const fullPaidCol = has.has(REQUESTS_FULL_PAID_COLUMN) ? REQUESTS_FULL_PAID_COLUMN : null;
  const fullPaidDateCol = has.has(REQUESTS_FULL_PAID_DATE_COLUMN) ? REQUESTS_FULL_PAID_DATE_COLUMN : null;
  const fullPaidEntryCol = has.has(REQUESTS_FULL_PAID_ENTRY_COLUMN) ? REQUESTS_FULL_PAID_ENTRY_COLUMN : null;

  if (canExpireBrief) {
    setClauses.push(`brief_bio_request = CASE WHEN ${briefExpire} THEN 'notrequested' ELSE brief_bio_request END`);
    setClauses.push(
      `brief_bio_request_approval = CASE WHEN ${briefExpire} THEN 'noresponse' ELSE brief_bio_request_approval END`
    );
    setClauses.push(`brief_approval_date = CASE WHEN ${briefExpire} THEN NULL ELSE brief_approval_date END`);
    if (briefPaidCol) {
      setClauses.push(`${briefPaidCol} = CASE WHEN ${briefExpire} THEN ${falsePaid} ELSE ${briefPaidCol} END`);
    }
    if (briefPaidDateCol) {
      setClauses.push(`${briefPaidDateCol} = CASE WHEN ${briefExpire} THEN NULL ELSE ${briefPaidDateCol} END`);
    }
    if (briefPaidEntryCol) {
      setClauses.push(`${briefPaidEntryCol} = CASE WHEN ${briefExpire} THEN NULL ELSE ${briefPaidEntryCol} END`);
    }
  }

  if (canExpireFull) {
    setClauses.push(`full_bio_request = CASE WHEN ${fullExpire} THEN 'notrequested' ELSE full_bio_request END`);
    setClauses.push(
      `full_bio_request_approval = CASE WHEN ${fullExpire} THEN 'noresponse' ELSE full_bio_request_approval END`
    );
    setClauses.push(`full_approval_date = CASE WHEN ${fullExpire} THEN NULL ELSE full_approval_date END`);
    if (fullPaidCol) {
      setClauses.push(`${fullPaidCol} = CASE WHEN ${fullExpire} THEN ${falsePaid} ELSE ${fullPaidCol} END`);
    }
    if (fullPaidDateCol) {
      setClauses.push(`${fullPaidDateCol} = CASE WHEN ${fullExpire} THEN NULL ELSE ${fullPaidDateCol} END`);
    }
    if (fullPaidEntryCol) {
      setClauses.push(`${fullPaidEntryCol} = CASE WHEN ${fullExpire} THEN NULL ELSE ${fullPaidEntryCol} END`);
    }
  }

  return setClauses;
}

/**
 * When approved viewing term (BIO_APPROVED_VIEW_DURATION months) ends, reset brief/full
 * request rows for incoming requests (singles_id_to = recipient).
 */
export async function expireElapsedApprovedViewing(
  pool,
  schemaName,
  singlesIdTo,
  viewingMonths = parseApprovedViewingDurationMonths()
) {
  const months = Number(viewingMonths);
  if (!Number.isFinite(months) || months < 0) return;

  const has = await getExpiryColumns(pool, schemaName);
  const canExpireBrief =
    has.has('brief_bio_request') &&
    has.has('brief_bio_request_approval') &&
    has.has('brief_approval_date');
  const canExpireFull =
    has.has('full_bio_request') &&
    has.has('full_bio_request_approval') &&
    has.has('full_approval_date');
  if (!canExpireBrief && !canExpireFull) return;

  const briefExpire = canExpireBrief ? briefViewingExpiredCondition(months) : 'FALSE';
  const fullExpire = canExpireFull ? fullViewingExpiredCondition(months) : 'FALSE';
  const setClauses = buildExpirySetClauses(has, schemaName, briefExpire, fullExpire, canExpireBrief, canExpireFull);

  await pool.query(
    `UPDATE ${schemaName}.requests
     SET ${setClauses.join(',\n         ')}
     WHERE singles_id_to = $1
       AND (${briefExpire} OR ${fullExpire})`,
    [singlesIdTo]
  );
}

/** Expire viewing on rows where JWT user is the outgoing requester (singles_id_from). */
export async function expireElapsedApprovedViewingForSender(
  pool,
  schemaName,
  singlesIdFrom,
  viewingMonths = parseApprovedViewingDurationMonths()
) {
  const months = Number(viewingMonths);
  if (!Number.isFinite(months) || months < 0) return;

  const has = await getExpiryColumns(pool, schemaName);
  const canExpireBrief =
    has.has('brief_bio_request') &&
    has.has('brief_bio_request_approval') &&
    has.has('brief_approval_date');
  const canExpireFull =
    has.has('full_bio_request') &&
    has.has('full_bio_request_approval') &&
    has.has('full_approval_date');
  if (!canExpireBrief && !canExpireFull) return;

  const briefExpire = canExpireBrief ? briefViewingExpiredCondition(months) : 'FALSE';
  const fullExpire = canExpireFull ? fullViewingExpiredCondition(months) : 'FALSE';
  const setClauses = buildExpirySetClauses(has, schemaName, briefExpire, fullExpire, canExpireBrief, canExpireFull);

  await pool.query(
    `UPDATE ${schemaName}.requests
     SET ${setClauses.join(',\n         ')}
     WHERE singles_id_from = $1
       AND (${briefExpire} OR ${fullExpire})`,
    [singlesIdFrom]
  );
}
