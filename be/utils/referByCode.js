/** Default when signup URL has no valid ?ref= A#### code — means no referrer. */
export const DEFAULT_REFER_BY_CODE = 'A0000';

/** 'A1234' from 'A1234' / 'a1234' / '1234'; '' for anything else. */
export function normalizeReferByCodeDigits(raw) {
  const m = String(raw ?? '')
    .trim()
    .toUpperCase()
    .match(/^A?(\d{4})$/);
  return m ? `A${m[1]}` : '';
}

/** True when code is the reserved no-referrer sentinel (A0000). */
export function isDefaultReferByCode(raw) {
  return normalizeReferByCodeDigits(raw) === DEFAULT_REFER_BY_CODE;
}

/** True when a signup may earn referral rewards (real A#### code, not the sentinel). */
export function isRewardEligibleReferByCode(raw) {
  const code = normalizeReferByCodeDigits(raw);
  return Boolean(code) && code !== DEFAULT_REFER_BY_CODE;
}

/** @param {string | null | undefined} raw — URL ?token= / ?ref= or API referByCode */
export function resolveReferByCode(raw) {
  return normalizeReferByCodeDigits(raw) || DEFAULT_REFER_BY_CODE;
}

/**
 * Prefer explicit request code, else registration_email metadata, else default.
 * Never treats A0000 from any source as a real referrer code.
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
