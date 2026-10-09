/** Admin Tools status-button cycle order (most-used first; not the enum sort order). */
export const SINGLES_STATUS_VALUES = Object.freeze([
  'active',
  'new',
  'under18',
  'inactive',
  'suspend',
  'abandon',
  'pause',
  'cancel',
  'unknown',
  'other',
  'blank'
]);

/** Registered member whose Driver License / Passport scan has not set active / under18 yet. */
export const SINGLES_STATUS_NEW = 'new';

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeSinglesStatus(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'cencel') return 'cancel';
  if (value === 'under_18' || value === 'under-18') return 'under18';
  return SINGLES_STATUS_VALUES.includes(value) ? value : null;
}

/**
 * @param {unknown} current
 * @returns {string}
 */
export function nextSinglesStatus(current) {
  const normalized = normalizeSinglesStatus(current) ?? 'blank';
  const index = SINGLES_STATUS_VALUES.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % SINGLES_STATUS_VALUES.length;
  return SINGLES_STATUS_VALUES[nextIndex];
}

export function isSinglesStatusNew(raw) {
  return normalizeSinglesStatus(raw) === SINGLES_STATUS_NEW;
}

export function isSinglesStatusUnder18(raw) {
  return normalizeSinglesStatus(raw) === 'under18';
}

/** singles.optinout_bitmap bits (bits 3–7 reserved). */
export const OPTINOUT_TUTADATES = 1;
export const OPTINOUT_TUTANOTES = 2;
export const OPTINOUT_TUTAPHOTOS = 4;
export const OPTINOUT_DEFAULT_BITMAP = OPTINOUT_TUTADATES | OPTINOUT_TUTANOTES | OPTINOUT_TUTAPHOTOS;

/** Statuses that may check / uncheck the TutaDates box (`new` goes through the ID-scan screens). */
const TUTADATES_ALLOWED_STATUSES = ['active', 'new'];

export const UNDER18_TUTADATES_MESSAGE =
  'You must be over 18 to use TutaDates. You can still use TutaNotes and TutaPhotos.';

export function normalizeOptinoutBitmap(raw) {
  const n = Number(raw);
  if (raw === null || raw === undefined || raw === '' || !Number.isInteger(n) || n < 0 || n > 255) {
    return OPTINOUT_DEFAULT_BITMAP;
  }
  return n;
}

export function isTutaDatesOptedIn(user) {
  return (normalizeOptinoutBitmap(user?.optinout_bitmap) & OPTINOUT_TUTADATES) !== 0;
}

export function canChangeTutaDatesOptIn(rawStatus) {
  return TUTADATES_ALLOWED_STATUSES.includes(normalizeSinglesStatus(rawStatus));
}

export function tutaDatesOptInBlockedMessage(rawStatus) {
  return `Please contact customer support, since your TutaDate status is '${normalizeSinglesStatus(rawStatus) ?? 'blank'}' and must be 'active' to optin TutaDates`;
}

/**
 * Why this member may not enter TutaDates because of singles.status (under18 included), or null.
 * The TutaDates opt-in bit is gated separately by the mall enrollment popup.
 */
export function tutaDatesStatusBlockMessage(user) {
  if (isSinglesStatusUnder18(user?.status) || user?.over_18_verified === false) return UNDER18_TUTADATES_MESSAGE;
  if (!canChangeTutaDatesOptIn(user?.status)) {
    return `Please contact customer support, since your TutaDate status is '${normalizeSinglesStatus(user?.status) ?? 'blank'}' and must be 'active' to use TutaDates`;
  }
  return null;
}

export function formatSinglesStatusLabel(raw) {
  const normalized = normalizeSinglesStatus(raw) ?? 'blank';
  if (normalized === 'blank') return 'Blank';
  if (normalized === 'under18') return 'Under 18';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
