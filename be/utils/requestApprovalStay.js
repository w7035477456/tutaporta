import { parseApprovalStayDurationDays } from './approvalStayDurationConfig.js';
import {
  APPROVAL_STATUS_APPROVE,
  APPROVAL_STATUS_NO_RESPONSE,
  normalizeApprovalStatus
} from './approvalStatusEnum.js';

function normalizeApprovalText(value) {
  return normalizeApprovalStatus(value) ?? APPROVAL_STATUS_NO_RESPONSE;
}

export async function expireElapsedRequestApprovals(pool, schemaName, has, singlesIdTo, stayDays = parseApprovalStayDurationDays()) {
  const days = Number(stayDays);
  if (!Number.isFinite(days) || days < 0) return;

  const canExpireBrief = has.has('brief_bio_request_approval') && has.has('brief_approval_date');
  const canExpireFull = has.has('full_bio_request_approval') && has.has('full_approval_date');
  if (!canExpireBrief && !canExpireFull) return;

  const briefExpire = canExpireBrief
    ? `(
        LOWER(BTRIM(COALESCE(brief_bio_request_approval::text, ''))) IN ('approve', 'approved')
        AND brief_approval_date IS NOT NULL
        AND (CURRENT_DATE - brief_approval_date) >= $2
      )`
    : 'FALSE';
  const fullExpire = canExpireFull
    ? `(
        LOWER(BTRIM(COALESCE(full_bio_request_approval::text, ''))) IN ('approve', 'approved')
        AND full_approval_date IS NOT NULL
        AND (CURRENT_DATE - full_approval_date) >= $2
      )`
    : 'FALSE';

  await pool.query(
    `UPDATE ${schemaName}.requests
     SET brief_bio_request_approval = CASE WHEN ${briefExpire} THEN 'noresponse' ELSE brief_bio_request_approval END,
         full_bio_request_approval = CASE WHEN ${fullExpire} THEN 'noresponse' ELSE full_bio_request_approval END,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id_to = $1
       AND (${briefExpire} OR ${fullExpire})`,
    [singlesIdTo, days]
  );
}

export function isApprovalLockedDuringStay({ approvalValue, approvalDate, stayDays = parseApprovalStayDurationDays() }) {
  if (normalizeApprovalText(approvalValue) !== APPROVAL_STATUS_APPROVE) return false;
  if (approvalDate == null || approvalDate === '') return false;
  const days = Number(stayDays);
  if (!Number.isFinite(days) || days < 0) return false;
  const dateText = String(approvalDate).trim().slice(0, 10);
  if (!dateText) return false;
  const start = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  const unlockDate = new Date(start);
  unlockDate.setDate(unlockDate.getDate() + days);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today < unlockDate;
}
