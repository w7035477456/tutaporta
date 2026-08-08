/** sessionStorage key — phone collected at sign-up */
export const SIGNUP_REGISTER_PHONE_KEY = 'signupRegisterPhone';

export const SIGNUP_CREATE_PASSWORD_PAYLOAD_KEY = 'signupCreatePasswordPayload';

export function formatPhoneNumber(value) {
  const phoneDigits = String(value ?? '').replace(/\D/g, '');
  if (phoneDigits.length <= 3) return phoneDigits;
  if (phoneDigits.length <= 6) return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3)}`;
  return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
}

/** URL-safe phone for query strings (formatted display value). */
export function encodePhoneForUrl(phone) {
  const formatted = formatPhoneNumber(phone);
  return formatted ? encodeURIComponent(formatted) : '';
}

export function decodePhoneFromUrl(raw) {
  if (!raw) return '';
  try {
    return formatPhoneNumber(decodeURIComponent(raw));
  } catch {
    return formatPhoneNumber(raw);
  }
}

export function getSignupPhoneFromSearchParams(searchParams) {
  const fromUrl = decodePhoneFromUrl(searchParams.get('phone') || '');
  if (fromUrl) return fromUrl;
  if (typeof sessionStorage === 'undefined') return '';
  return formatPhoneNumber(sessionStorage.getItem(SIGNUP_REGISTER_PHONE_KEY) || '');
}

import { normalizeSignupReferralCode } from './signupReferralCode';

export function buildCreatePasswordQuery({ email, code, phone, token, ref }) {
  const params = new URLSearchParams();
  if (email) params.set('email', email.trim().toLowerCase());
  if (code) params.set('code', String(code).trim().toUpperCase());
  const phoneEnc = encodePhoneForUrl(phone);
  if (phoneEnc) params.set('phone', decodeURIComponent(phoneEnc));
  const referralToken = normalizeSignupReferralCode(token ?? ref ?? '');
  if (referralToken) params.set('token', referralToken);
  return params.toString();
}
