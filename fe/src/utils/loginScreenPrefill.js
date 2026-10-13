/** One-shot login email/id prefill after hard redirect to /pages/login (sessionStorage survives replace). */
const LOGIN_EMAIL_PREFILL_KEY = 'loginScreenEmailPrefill';

/** Survives React Strict Mode remount (sessionStorage is only read once per page load). */
let loginEmailPrefillMemory;

export function storeLoginEmailPrefill(email) {
  if (typeof sessionStorage === 'undefined') return;
  const trimmed = String(email ?? '').trim();
  if (!trimmed) return;
  loginEmailPrefillMemory = undefined;
  sessionStorage.setItem(LOGIN_EMAIL_PREFILL_KEY, trimmed);
}

export function consumeLoginEmailPrefill() {
  if (loginEmailPrefillMemory !== undefined) {
    return loginEmailPrefillMemory;
  }
  if (typeof sessionStorage === 'undefined') {
    loginEmailPrefillMemory = null;
    return null;
  }
  const raw = sessionStorage.getItem(LOGIN_EMAIL_PREFILL_KEY);
  sessionStorage.removeItem(LOGIN_EMAIL_PREFILL_KEY);
  const trimmed = String(raw ?? '').trim();
  loginEmailPrefillMemory = trimmed || null;
  return loginEmailPrefillMemory;
}
