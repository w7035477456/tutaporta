/** Verification Services table statuses (id/work/education channels). */
export const VERIFICATION_STATUS_CYCLE = ['notstarted', 'completed', 'error'];

export function normalizeVerificationStatusKey(status) {
  const key = String(status ?? 'notstarted').trim().toLowerCase();
  if (VERIFICATION_STATUS_CYCLE.includes(key)) return key;
  return 'notstarted';
}

export function verificationStatusLabel(status) {
  const key = normalizeVerificationStatusKey(status);
  if (key === 'completed') return 'Completed';
  if (key === 'error') return 'Error';
  return 'Not Started';
}

export function cycleVerificationStatus(current) {
  const normalized = normalizeVerificationStatusKey(current);
  // Admin reset: one click from Completed back to Not Started.
  if (normalized === 'completed') return 'notstarted';
  const idx = VERIFICATION_STATUS_CYCLE.indexOf(normalized);
  return VERIFICATION_STATUS_CYCLE[(idx + 1) % VERIFICATION_STATUS_CYCLE.length];
}
