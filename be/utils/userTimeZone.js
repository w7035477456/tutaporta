import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AREA_CODE_TZ_MAP = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../constants/usAreaCodeIanaTimeZones.json'),
    'utf8'
  )
);

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
