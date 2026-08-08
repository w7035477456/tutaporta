/** Default when signup URL has no valid ?ref= six-digit code — means no referrer. */
export const DEFAULT_REFER_BY_CODE = '123456';

export function normalizeReferByCodeDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : '';
}

/** True when code is the reserved no-referrer sentinel (123456). */
export function isDefaultReferByCode(raw) {
  return normalizeReferByCodeDigits(raw) === DEFAULT_REFER_BY_CODE;
}

/** True when a signup may earn referral rewards (real six-digit code, not the sentinel). */
export function isRewardEligibleReferByCode(raw) {
  const digits = normalizeReferByCodeDigits(raw);
  return Boolean(digits) && digits !== DEFAULT_REFER_BY_CODE;
}

/** @param {string | null | undefined} raw — URL ?token= / ?ref= or API referByCode */
export function resolveReferByCode(raw) {
  if (isDefaultReferByCode(raw)) return DEFAULT_REFER_BY_CODE;
  const digits = normalizeReferByCodeDigits(raw);
  if (digits) return digits;
  return DEFAULT_REFER_BY_CODE;
}

/**
 * Prefer explicit request code, else registration_email metadata, else default.
 * Never treats 123456 from any source as a real referrer code.
 * @param {{ referByCode?: string, ref?: string, token?: string, metaRef?: string }} sources
 */
export function resolveReferByCodeForSignup(sources = {}) {
  const candidates = [sources.referByCode, sources.ref, sources.token, sources.metaRef];
  for (const raw of candidates) {
    const resolved = resolveReferByCode(raw);
    if (resolved !== DEFAULT_REFER_BY_CODE) return resolved;
  }
  return DEFAULT_REFER_BY_CODE;
}
