import { formatUserDateTimeAtStyle } from 'utils/userTimeZone';

export const NOT_AVAILABLE = 'Not Available';

const VETTED_DATE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VETTED_DATE_MONTH_MAP = Object.fromEntries(VETTED_DATE_MONTHS.map((m, i) => [m.toLowerCase(), i]));

function formatLocalDateTimeParts(d) {
  const mon = VETTED_DATE_MONTHS[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  let h = d.getHours();
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h %= 12;
  if (h === 0) h = 12;
  const hh = String(h).padStart(2, '0');
  return `${mon} ${day}, ${year} at ${hh}:${mi} ${ampm}`;
}

/** Display like PostgreSQL to_char: 'Mon DD, YYYY at HH12:MI AM' plus user timezone when profile provided. */
export function toDisplayVettedDate(raw, userTimeZoneProfile = null) {
  if (raw == null) return NOT_AVAILABLE;
  let date = null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    date = new Date(raw);
  } else if (raw instanceof Date) {
    date = raw;
  } else {
    const s = String(raw).trim();
    if (!s || s.toLowerCase() === 'n/a' || s === NOT_AVAILABLE) return NOT_AVAILABLE;
    const t = Date.parse(s);
    if (Number.isNaN(t)) return NOT_AVAILABLE;
    date = new Date(t);
  }
  if (Number.isNaN(date.getTime())) return NOT_AVAILABLE;
  if (userTimeZoneProfile && (userTimeZoneProfile.zip || userTimeZoneProfile.phone)) {
    return formatUserDateTimeAtStyle(date, userTimeZoneProfile);
  }
  return formatLocalDateTimeParts(date);
}

/** Parse ISO or display format to Date for API; returns null for empty / Not Available */
export function parseVettedDateForSave(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === 'not available' || s.toLowerCase() === 'n/a') return null;
  const isoTry = Date.parse(s);
  if (!Number.isNaN(isoTry)) return new Date(isoTry);
  const m = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s+[A-Z]{2,4})?$/i);
  if (m) {
    const monKey = m[1].slice(0, 3).toLowerCase();
    const mon = VETTED_DATE_MONTH_MAP[monKey];
    if (mon == null) return null;
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const ap = m[6].toUpperCase();
    if (ap === 'PM' && hour < 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    const d = new Date(year, mon, day, hour, minute, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const relaxed = Date.parse(s.replace(/\s+at\s+/i, ' '));
  if (!Number.isNaN(relaxed)) return new Date(relaxed);
  return null;
}

/** ISO for API when parsable; null for empty/NA; else original string for backend parsing */
export function vettedDateForSavePayload(raw) {
  const s0 = String(raw ?? '').trim();
  if (!s0 || s0.toLowerCase() === 'not available' || s0.toLowerCase() === 'n/a') return null;
  const d = parseVettedDateForSave(raw);
  if (d != null) return d.toISOString();
  return s0;
}
