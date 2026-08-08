import areaCodeTimeZones from '../constants/usAreaCodeIanaTimeZones.json';

const AREA_CODE_TZ_MAP = areaCodeTimeZones;

export function normalizeUsPhoneDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function resolveUsTimeZoneFromZip(zip) {
  const z = String(zip ?? '').trim();
  if (!/^\d{5}$/.test(z)) return null;
  const first = Number(z[0]);
  if ([0, 1, 2, 3, 4].includes(first)) return 'America/New_York';
  if ([5, 6].includes(first)) return 'America/Chicago';
  return 'America/Los_Angeles';
}

export function resolveUsTimeZoneFromPhone(phone) {
  const digits = normalizeUsPhoneDigits(phone);
  if (digits.length !== 10) return null;
  const areaCode = digits.slice(0, 3);
  return AREA_CODE_TZ_MAP[areaCode] || null;
}

/** Prefer mailing zip; fall back to phone area code; default Eastern. */
export function resolveUserTimeZone({ zip = null, phone = null } = {}) {
  return resolveUsTimeZoneFromZip(zip) || resolveUsTimeZoneFromPhone(phone) || 'America/New_York';
}

export function getTimeZoneAbbreviation(ianaTimeZone, date = new Date()) {
  const tz = String(ianaTimeZone || 'America/New_York');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short'
  }).formatToParts(date);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value || '';
  if (/^E[DS]T$/i.test(raw)) return 'ET';
  if (/^C[DS]T$/i.test(raw)) return 'CT';
  if (/^P[DS]T$/i.test(raw)) return 'PT';
  if (/^M[DS]T$/i.test(raw)) return 'MT';
  if (/^AK[DS]T$/i.test(raw)) return 'AKT';
  if (/^HST$/i.test(raw)) return 'HT';
  return raw || 'ET';
}

/**
 * @param {Date|string|number} value
 * @param {{ zip?: string|null, phone?: string|null, style?: 'short'|'numeric' }} [options]
 */
export function formatUserDateTime(value, { zip = null, phone = null, style = 'numeric' } = {}) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = resolveUserTimeZone({ zip, phone });
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: style === 'short' ? 'short' : '2-digit',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
  const abbr = getTimeZoneAbbreviation(timeZone, date);
  return abbr ? `${formatted} ${abbr}` : formatted;
}

const VETTED_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Like vetted-date UI: `Mon DD, YYYY at HH:MM AM/PM ET` */
export function formatUserDateTimeAtStyle(value, { zip = null, phone = null } = {}) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = resolveUserTimeZone({ zip, phone });
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value || '';
  const monthIdx = Math.max(0, Math.min(11, Number(read('month')) - 1));
  const mon = VETTED_MONTHS[monthIdx] || read('month');
  const day = String(read('day')).padStart(2, '0');
  const year = read('year');
  const hour = read('hour');
  const minute = read('minute');
  const dayPeriod = read('dayPeriod');
  const abbr = getTimeZoneAbbreviation(timeZone, date);
  return `${mon} ${day}, ${year} at ${hour}:${minute} ${dayPeriod}${abbr ? ` ${abbr}` : ''}`;
}

const EMBEDDED_DATETIME_PATTERN_SOURCES = [
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s+\\d{4},\\s+\\d{1,2}:\\d{2}\\s*(?:AM|PM)(?:\\s+(?:ET|CT|PT|MT|AKT|HT))?',
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4},\\s+\\d{1,2}:\\d{2}\\s*(?:AM|PM)(?:\\s+(?:ET|CT|PT|MT|AKT|HT))?',
  '\\d{1,2}\\/\\d{1,2}\\/\\d{4},\\s*\\d{1,2}:\\d{2}\\s*(?:AM|PM)(?:\\s+(?:ET|CT|PT|MT|AKT|HT))?',
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s+\\d{4}\\s+at\\s+\\d{1,2}:\\d{2}\\s*(?:AM|PM)(?:\\s+(?:ET|CT|PT|MT|AKT|HT))?'
];

function replaceFirstEmbeddedDateTime(raw, replacement) {
  for (const source of EMBEDDED_DATETIME_PATTERN_SOURCES) {
    const pattern = new RegExp(source, 'i');
    const match = raw.match(pattern);
    if (match) {
      return raw.replace(pattern, replacement);
    }
  }
  return null;
}

/**
 * Normalize free-text that embeds a datetime (e.g. payment descriptions).
 * When referenceDate is provided, replaces the first embedded datetime with the user's timezone label.
 */
export function formatTextEmbeddedDateTimes(text, userTimeZoneProfile = {}, referenceDate = null) {
  const raw = String(text ?? '');
  if (!raw) return raw;

  const ref = referenceDate != null ? new Date(referenceDate) : null;
  const hasValidRef = ref && !Number.isNaN(ref.getTime());
  if (hasValidRef) {
    const replacement = formatUserDateTime(ref, { ...userTimeZoneProfile, style: 'short' });
    if (replacement) {
      const replaced = replaceFirstEmbeddedDateTime(raw, replacement);
      if (replaced != null) return replaced;
    }
  }

  if (/\b(?:ET|CT|PT|MT|AKT|HT)\b/.test(raw)) return raw;
  const tz = getTimeZoneAbbreviation(resolveUserTimeZone(userTimeZoneProfile), ref || new Date());
  return raw.replace(/(\d{1,2}:\d{2}\s*(?:AM|PM))(?!\s+(?:ET|CT|PT|MT|AKT|HT))/gi, `$1 ${tz}`);
}

export function formatPaymentHistoryDescription(description, occurredAt, userTimeZoneProfile = {}) {
  return formatTextEmbeddedDateTimes(description, userTimeZoneProfile, occurredAt);
}
