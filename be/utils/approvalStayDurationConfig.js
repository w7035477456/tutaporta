/** Minimum days an approval stays locked (~/.ssh/be/.env ADD_DAYS_TO_DATE_APPROVE_STAY_DURATION). */
export function parseApprovalStayDurationDays(env = process.env) {
  const raw = String(env.ADD_DAYS_TO_DATE_APPROVE_STAY_DURATION ?? '90').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 90;
  return parsed;
}
