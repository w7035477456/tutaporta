export const ACCOUNT_CHANGE_COOLDOWN_DAYS = 7;

export const ACCOUNT_CHANGE_DATE_COLUMNS = {
  password: 'last_password_change_date',
  email: 'last_email_change_date',
  phone: 'last_phone_change_date'
};

function parseDateOnly(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const copy = new Date(raw);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }
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

/** @returns {Date|null} last change + 7 calendar days */
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

export function isAccountChangeCooldownActive(lastChangeDateRaw, today = startOfToday()) {
  const retry = getAccountChangeRetryDate(lastChangeDateRaw);
  if (!retry) return false;
  return today < retry;
}

export function buildAccountChangeCooldownMessage(retryDateFormatted) {
  const retryLabel = retryDateFormatted || 'a later date';
  return `For security, we only allow change to password, phone, or email once per 7 days. Please try again on or after ${retryLabel}. Click Support at bottom right and message us there if you need further help.`;
}

export function accountChangeCooldownHttpResponse(lastChangeDateRaw) {
  const retryAfterDate = formatAccountChangeRetryDate(lastChangeDateRaw);
  return {
    statusCode: 403,
    body: {
      error: buildAccountChangeCooldownMessage(retryAfterDate),
      changeCooldownActive: true,
      retryAfterDate
    }
  };
}

export function formatLastChangeDateForApi(raw) {
  const parsed = parseDateOnly(raw);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function loadAccountChangeDates(db, singlesId) {
  const { rows } = await db.query(
    `SELECT last_password_change_date, last_email_change_date, last_phone_change_date
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return rows[0] || {};
}

export async function assertAccountChangeAllowed(db, singlesId, kind) {
  const column = ACCOUNT_CHANGE_DATE_COLUMNS[kind];
  if (!column) return null;
  const row = await loadAccountChangeDates(db, singlesId);
  const lastRaw = row[column];
  if (!isAccountChangeCooldownActive(lastRaw)) return null;
  return accountChangeCooldownHttpResponse(lastRaw);
}
