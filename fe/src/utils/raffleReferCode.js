import api from 'api/axios';

/** sessionStorage — R#### Raffle Refer Code typed on /register (Google signup finishes on another page). */
const SIGNUP_RAFFLE_REFER_CODE_KEY = 'signupRaffleReferCode';

export const RAFFLE_REFER_INVALID_MESSAGE =
  'Incorrect refer code. Please retry so your friend get refer credit, or leave it blank and continue';

/** 'R1234' from 'R1234' / 'r1234' / '1234'; '' for anything else. */
export function normalizeRaffleReferCode(raw) {
  const m = String(raw ?? '')
    .trim()
    .toUpperCase()
    .match(/^R?(\d{4})$/);
  return m ? `R${m[1]}` : '';
}

export function storeSignupRaffleReferCode(code) {
  if (typeof sessionStorage === 'undefined') return;
  const normalized = normalizeRaffleReferCode(code);
  if (normalized) sessionStorage.setItem(SIGNUP_RAFFLE_REFER_CODE_KEY, normalized);
  else sessionStorage.removeItem(SIGNUP_RAFFLE_REFER_CODE_KEY);
}

export function readSignupRaffleReferCode() {
  if (typeof sessionStorage === 'undefined') return '';
  return normalizeRaffleReferCode(sessionStorage.getItem(SIGNUP_RAFFLE_REFER_CODE_KEY));
}

export function clearSignupRaffleReferCode() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SIGNUP_RAFFLE_REFER_CODE_KEY);
}

export async function validateRaffleReferCode(code) {
  const { data } = await api.get('/api/raffle/refer-code/validate', { params: { code: normalizeRaffleReferCode(code) } });
  return data?.valid === true;
}
