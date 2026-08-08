/** Canonical PostgreSQL `approval_status_enum` values. */
export const APPROVAL_STATUS = Object.freeze({
  APPROVE: 'approve',
  DENY: 'deny',
  NO_RESPONSE: 'noresponse'
});

/** Normalize API/DB approval values to canonical enum strings. */
export function normalizeApprovalStatus(value) {
  if (value === true || value === 1) return APPROVAL_STATUS.APPROVE;
  if (value === false || value === 0) return APPROVAL_STATUS.DENY;
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', 'approve', 'approved', 'yes', '1'].includes(text)) return APPROVAL_STATUS.APPROVE;
  if (['false', 'denied', 'deny', 'disapprove', 'disapproved', 'no', '0'].includes(text)) {
    return APPROVAL_STATUS.DENY;
  }
  if (['na', 'n/a', 'noresponse', 'no response', 'none', 'null', ''].includes(text)) {
    return APPROVAL_STATUS.NO_RESPONSE;
  }
  return APPROVAL_STATUS.NO_RESPONSE;
}

export function isNoResponseApprovalStatus(value) {
  return normalizeApprovalStatus(value) === APPROVAL_STATUS.NO_RESPONSE;
}
