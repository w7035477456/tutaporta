/** M + six-digit member_id (e.g. M100123). */
export function formatMemberDisplayCode(memberIdValue) {
  const n = Number(memberIdValue);
  if (!Number.isFinite(n) || n < 0) return null;
  return `M${String(Math.trunc(n)).padStart(6, '0')}`;
}

/** Six-digit member_id string (no M prefix). */
export function formatMemberIdDigits(memberIdValue) {
  const n = Number(memberIdValue);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(Math.trunc(n)).padStart(6, '0');
}
