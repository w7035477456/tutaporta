import { normalizeSinglesStatus } from './singlesStatus.js';

/** singles.optinout_bitmap bits (bits 3–7 reserved). */
export const OPTINOUT_TUTADATES = 1;
export const OPTINOUT_TUTANOTES = 2;
export const OPTINOUT_TUTAPHOTOS = 4;
export const OPTINOUT_ALL_APPS = OPTINOUT_TUTADATES | OPTINOUT_TUTANOTES | OPTINOUT_TUTAPHOTOS;
export const OPTINOUT_DEFAULT_BITMAP = OPTINOUT_ALL_APPS;

/** Mall enrollment API keys ↔ bitmap bits. */
export const OPTINOUT_API_KEY_TO_BIT = Object.freeze({
  tutaDatesEnabled: OPTINOUT_TUTADATES,
  tutaNotesEnabled: OPTINOUT_TUTANOTES,
  tutaAlbumsEnabled: OPTINOUT_TUTAPHOTOS
});

/** Statuses that may check / uncheck the TutaDates box (`new` goes through the ID-scan screens). */
export const TUTADATES_OPTIN_STATUSES = Object.freeze(['active', 'new']);

/**
 * @param {unknown} raw
 * @returns {number} 0–255; null / garbage → default (all apps).
 */
export function normalizeOptinoutBitmap(raw) {
  if (raw === null || raw === undefined || raw === '') return OPTINOUT_DEFAULT_BITMAP;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 255) return OPTINOUT_DEFAULT_BITMAP;
  return n;
}

/**
 * @param {unknown} bitmap
 * @returns {{ tutaDatesEnabled: boolean, tutaNotesEnabled: boolean, tutaAlbumsEnabled: boolean }}
 */
export function optinoutBitmapToEnrollment(bitmap) {
  const n = normalizeOptinoutBitmap(bitmap);
  return {
    tutaDatesEnabled: (n & OPTINOUT_TUTADATES) !== 0,
    tutaNotesEnabled: (n & OPTINOUT_TUTANOTES) !== 0,
    tutaAlbumsEnabled: (n & OPTINOUT_TUTAPHOTOS) !== 0
  };
}

/**
 * @param {unknown} bitmap current value
 * @param {Partial<Record<keyof typeof OPTINOUT_API_KEY_TO_BIT, boolean>>} patch
 * @returns {number}
 */
export function applyEnrollmentPatchToBitmap(bitmap, patch) {
  let n = normalizeOptinoutBitmap(bitmap);
  for (const [key, bit] of Object.entries(OPTINOUT_API_KEY_TO_BIT)) {
    if (!Object.prototype.hasOwnProperty.call(patch ?? {}, key)) continue;
    n = patch[key] ? n | bit : n & ~bit;
  }
  return n;
}

/**
 * @param {unknown} rawStatus
 * @returns {boolean}
 */
export function canChangeTutaDatesOptIn(rawStatus) {
  return TUTADATES_OPTIN_STATUSES.includes(normalizeSinglesStatus(rawStatus));
}

/**
 * @param {unknown} rawStatus
 * @returns {string}
 */
export function tutaDatesOptInBlockedMessage(rawStatus) {
  return `Please contact customer support, since your TutaDate status is '${normalizeSinglesStatus(rawStatus) ?? 'blank'}' and must be 'active' to optin TutaDates`;
}

/**
 * SQL fragment: TutaDates bit set on singles.optinout_bitmap.
 * @param {string} [alias]
 */
export function buildTutaDatesOptedInWhereSql(alias = 's') {
  return `(COALESCE(${alias}.optinout_bitmap, ${OPTINOUT_DEFAULT_BITMAP}) & ${OPTINOUT_TUTADATES}) = ${OPTINOUT_TUTADATES}`;
}

/**
 * Listed on /allSingles + dating menus: TutaDates opted in AND status active.
 * @param {unknown} rawStatus
 * @param {unknown} bitmap
 */
export function isVisibleOnTutaDates(rawStatus, bitmap) {
  return normalizeSinglesStatus(rawStatus) === 'active' && optinoutBitmapToEnrollment(bitmap).tutaDatesEnabled;
}
