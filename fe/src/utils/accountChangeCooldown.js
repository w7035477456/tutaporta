export const ACCOUNT_CHANGE_COOLDOWN_DAYS = 7;

function parseDateOnly(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getAccountChangeRetryDate(lastChangeDateRaw) {
  const last = parseDateOnly(lastChangeDateRaw);
  if (!last) return null;
  const retry = new Date(last);
  retry.setDate(retry.getDate() + ACCOUNT_CHANGE_COOLDOWN_DAYS);
  retry.setHours(0, 0, 0, 0);
  return retry;
}

export function formatAccountChangeRetryDate(lastChangeDateRaw) {
  const retry = getAccountChangeRetryDate(lastChangeDateRaw);
  if (!retry) return null;
  return retry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function isAccountChangeCooldownActive(lastChangeDateRaw) {
  const retry = getAccountChangeRetryDate(lastChangeDateRaw);
  if (!retry) return false;
  return startOfToday() < retry;
}

export function buildAccountChangeCooldownMessage(retryDateFormatted) {
  const retryLabel = retryDateFormatted || 'a later date';
  return `For security, we only allow change to password, phone, or email once per 7 days. Please try again on or after ${retryLabel}. Click Support at bottom right and message us there if you need further help.`;
}

export function todayDateStringLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
