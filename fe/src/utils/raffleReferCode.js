import api from 'api/axios';

/** sessionStorage — 4-digit Raffle Refer Code typed on /register (Google signup finishes on another page). */
const SIGNUP_RAFFLE_REFER_CODE_KEY = 'signupRaffleReferCode';

export const RAFFLE_REFER_INVALID_MESSAGE =
  'Incorrect refer code. Please retry so your friend get refer credit, or leave it blank and continue';

export function storeSignupRaffleReferCode(code) {
  if (typeof sessionStorage === 'undefined') return;
  if (/^[0-9]{4}$/.test(code)) sessionStorage.setItem(SIGNUP_RAFFLE_REFER_CODE_KEY, code);
  else sessionStorage.removeItem(SIGNUP_RAFFLE_REFER_CODE_KEY);
}

export function readSignupRaffleReferCode() {
  if (typeof sessionStorage === 'undefined') return '';
  const code = sessionStorage.getItem(SIGNUP_RAFFLE_REFER_CODE_KEY) || '';
  return /^[0-9]{4}$/.test(code) ? code : '';
}

export function clearSignupRaffleReferCode() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SIGNUP_RAFFLE_REFER_CODE_KEY);
}

export async function validateRaffleReferCode(code) {
  const { data } = await api.get('/api/raffle/refer-code/validate', { params: { code } });
  return data?.valid === true;
}
