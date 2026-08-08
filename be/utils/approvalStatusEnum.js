/** Canonical PostgreSQL `approval_status_enum` values. */
export const APPROVAL_STATUS_APPROVE = 'approve';
export const APPROVAL_STATUS_DENY = 'deny';
export const APPROVAL_STATUS_NO_RESPONSE = 'noresponse';

/** SQL IN list for unanswered approval (includes legacy `na` during rollout). */
export const APPROVAL_STATUS_NO_RESPONSE_SQL_IN = "('noresponse', 'na', '', 'null')";

/** SQL NOT IN list for answered approval (includes legacy `na` during rollout). */
export const APPROVAL_STATUS_RESPONDED_SQL_NOT_IN = "('noresponse', 'na', '', 'null')";

export function normalizeApprovalStatus(value) {
  if (typeof value === 'boolean') {
    return value ? APPROVAL_STATUS_APPROVE : APPROVAL_STATUS_DENY;
  }
  if (typeof value === 'number') {
    if (value === 1) return APPROVAL_STATUS_APPROVE;
    if (value === 0) return APPROVAL_STATUS_DENY;
  }
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', 'approve', 'approved', 'yes', '1'].includes(text)) return APPROVAL_STATUS_APPROVE;
  if (['false', 'denied', 'deny', 'disapprove', 'disapproved', 'no', '0'].includes(text)) {
    return APPROVAL_STATUS_DENY;
  }
  if (['na', 'n/a', 'noresponse', 'no response', 'none', 'null', ''].includes(text)) {
    return APPROVAL_STATUS_NO_RESPONSE;
  }
  return null;
}

export function isNoResponseApprovalStatus(value) {
  return normalizeApprovalStatus(value) === APPROVAL_STATUS_NO_RESPONSE;
}
