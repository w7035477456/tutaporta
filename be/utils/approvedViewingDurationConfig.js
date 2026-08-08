/** Minimum approved bio viewing period (~/.ssh/be/.env BIO_APPROVED_VIEW_DURATION, months). */
export function parseApprovedViewingDurationMonths(env = process.env) {
  const raw = String(env.BIO_APPROVED_VIEW_DURATION ?? '12').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 12;
  return parsed;
}
