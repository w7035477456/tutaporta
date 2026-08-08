/** sessionStorage — six-digit ?ref= from /register (persists through signup). */
export const SIGNUP_REFERRAL_CODE_KEY = 'signupReferralCode';

export const DEFAULT_REFER_BY_CODE = '123456';

/** @param {string | null | undefined} raw */
export function normalizeSignupReferralCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : '';
}

export function isDefaultReferByCode(raw) {
  return normalizeSignupReferralCode(raw) === DEFAULT_REFER_BY_CODE;
}

export function isRewardEligibleReferralCode(raw) {
  const code = normalizeSignupReferralCode(raw);
  return Boolean(code) && code !== DEFAULT_REFER_BY_CODE;
}

export function readStoredSignupReferralCode() {
  if (typeof sessionStorage === 'undefined') return '';
  const stored = normalizeSignupReferralCode(sessionStorage.getItem(SIGNUP_REFERRAL_CODE_KEY));
  if (!stored || isDefaultReferByCode(stored)) return '';
  return stored;
}

export function persistSignupReferralCode(raw) {
  const code = normalizeSignupReferralCode(raw);
  if (typeof sessionStorage === 'undefined') return '';
  if (!code || isDefaultReferByCode(code)) {
    clearStoredSignupReferralCode();
    return '';
  }
  sessionStorage.setItem(SIGNUP_REFERRAL_CODE_KEY, code);
  return code;
}

export function clearStoredSignupReferralCode() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SIGNUP_REFERRAL_CODE_KEY);
}

/** After first Make this Profile, show Balance History + referee reward popup. */
export const REFEREE_REWARD_UX_AFTER_PROFILE_KEY = 'refereeRewardUxAfterProfile';

/** Call before clearStoredSignupReferralCode when signup used a real referrer code. */
export function markRefereeRewardUxAfterProfileSetup() {
  const code = readStoredSignupReferralCode();
  if (!isRewardEligibleReferralCode(code)) return;
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(REFEREE_REWARD_UX_AFTER_PROFILE_KEY, '1');
}

export function shouldShowRefereeRewardUxAfterProfileSetup() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(REFEREE_REWARD_UX_AFTER_PROFILE_KEY) === '1';
}

export function clearRefereeRewardUxAfterProfileSetup() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(REFEREE_REWARD_UX_AFTER_PROFILE_KEY);
}

/** ?token= or ?ref= on /claimtoken (six-digit referrer code). */
export function getClaimTokenReferralFromSearchParams(searchParams) {
  return persistSignupReferralCode(searchParams?.get?.('token') ?? searchParams?.get?.('ref') ?? '');
}

/** Prefer URL ?ref= or ?token=; clears stale session when URL has no referrer. */
export function getSignupReferralCodeFromSearchParams(searchParams) {
  const fromUrl = normalizeSignupReferralCode(
    searchParams?.get?.('ref') ?? searchParams?.get?.('token') ?? ''
  );
  if (fromUrl) {
    return persistSignupReferralCode(fromUrl);
  }
  clearStoredSignupReferralCode();
  return '';
}

/** Navigate target after manual code entry on /claimtoken — stores code and returns /register?ref=… */
export function buildRegisterUrlWithReferral(rawCode) {
  const code = persistSignupReferralCode(rawCode);
  if (!code) return '/register';
  return `/register?ref=${encodeURIComponent(code)}`;
}

/** Navigate target after manual code entry on /entertoken — stores code and returns /entertoken?token=… */
export function buildEnterTokenUrlWithReferral(rawCode) {
  const code = persistSignupReferralCode(rawCode);
  if (!code) return '/entertoken';
  return `/entertoken?token=${encodeURIComponent(code)}`;
}

/** Code sent to BE on successful registration (valid ref or default 123456). */
export function resolveSignupReferByCodeForApi() {
  return readStoredSignupReferralCode() || DEFAULT_REFER_BY_CODE;
}

/** Green status line on register / create-password when ?token= resolves to a referrer. */
export function formatValidReferralMessage(referrerAlias, referrerMemberCode) {
  const alias = String(referrerAlias ?? '').trim();
  const memberCode = String(referrerMemberCode ?? '').trim();
  if (alias && memberCode) {
    return `Registration via a valid referer code by ${alias} (${memberCode})`;
  }
  if (alias) {
    return `Registration via a valid referer code by ${alias}`;
  }
  if (memberCode) {
    return `Registration via a valid referer code by (${memberCode})`;
  }
  return 'Registration via a valid referer code';
}

/** Public invite link — /entertoken?token= (opens sign-up with referrer applied). */
export function buildEnterTokenReferralUrl(myReferCode) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const code = normalizeSignupReferralCode(myReferCode);
  const base = `${origin}/entertoken`;
  return code && !isDefaultReferByCode(code) ? `${base}?token=${encodeURIComponent(code)}` : base;
}

/** @deprecated use buildEnterTokenReferralUrl */
export function buildClaimTokenReferralUrl(myReferCode) {
  return buildEnterTokenReferralUrl(myReferCode);
}

/** @deprecated use buildEnterTokenReferralUrl */
export function buildRegisterReferralUrl(myReferCode) {
  return buildEnterTokenReferralUrl(myReferCode);
}
