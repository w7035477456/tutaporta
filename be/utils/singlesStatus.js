import { isRegularMemberCategory } from './memberCategory.js';

/** @typedef {'active' | 'cancel' | 'suspend' | 'pause' | 'abandon' | 'unknown' | 'other' | 'blank' | 'inactive' | 'under18' | 'new'} SinglesStatus */

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

/** Status for a freshly registered member until the Driver License / Passport scan sets active or under18. */
export const SINGLES_STATUS_NEW = 'new';

/** Exact under18 copy for the ID-scan popup, open-session logout, and refused login (product copy). */
export const UNDER18_LOGIN_ERROR = 'You must be over 18 to use this site';

/**
 * @param {unknown} raw
 * @returns {SinglesStatus | null}
 */
export function normalizeSinglesStatus(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'cencel') return 'cancel';
  // Accept "notactive" / "not_active" as inactive.
  if (value === 'notactive' || value === 'not_active' || value === 'not-active') return 'inactive';
  if (value === 'under_18' || value === 'under-18') return 'under18';
  return SINGLES_STATUS_VALUES.includes(value) ? value : null;
}

/**
 * @param {unknown} current
 * @returns {SinglesStatus}
 */
export function nextSinglesStatus(current) {
  const normalized = normalizeSinglesStatus(current) ?? 'blank';
  const index = SINGLES_STATUS_VALUES.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % SINGLES_STATUS_VALUES.length;
  return SINGLES_STATUS_VALUES[nextIndex];
}

/**
 * Map singles.status to audit_registrations.status.
 * @param {unknown} singlesStatus
 * @returns {'change' | 'new' | 'cancel' | 'suspend' | 'other'}
 */
export function mapSinglesStatusToAuditStatus(singlesStatus) {
  const normalized = normalizeSinglesStatus(singlesStatus);
  if (normalized === 'cancel') return 'cancel';
  if (normalized === 'suspend') return 'suspend';
  return 'other';
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatSinglesStatusLabel(raw) {
  const normalized = normalizeSinglesStatus(raw) ?? 'blank';
  if (normalized === 'blank') return 'Blank';
  if (normalized === 'under18') return 'Under 18';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** `new` may log in so the member can finish onboarding (FE keeps them off TutaDates until the ID scan). */
export const SINGLES_LOGIN_ALLOWED_STATUSES = Object.freeze(['active', 'pause', 'new']);

/**
 * Never logged in, whatever the member category: login is refused and any open session
 * (TutaDates / TutaNotes / TutaPhotos) is ended on its next request. NULL status counts as blank.
 */
export const SINGLES_FORCE_LOGOUT_STATUSES = Object.freeze([
  'suspend',
  'inactive',
  'abandon',
  'blank',
  'under18',
  'unknown',
  'other'
]);

/**
 * @param {unknown} rawStatus
 * @returns {boolean}
 */
export function isSinglesStatusForceLogout(rawStatus) {
  return SINGLES_FORCE_LOGOUT_STATUSES.includes(normalizeSinglesStatus(rawStatus) ?? 'blank');
}

/**
 * @param {unknown} rawStatus
 * @returns {string}
 */
export function singlesStatusBlockedMessage(rawStatus) {
  const status = normalizeSinglesStatus(rawStatus) ?? 'blank';
  return `Please contact customer support, since your status is '${status}' and must be 'active' to Login`;
}

/**
 * Listing surfaces (All Singles / Picks & Posts / Acquaint. & Buddies) only show active members.
 * @param {unknown} rawStatus
 * @returns {boolean}
 */
export function isSinglesStatusActive(rawStatus) {
  return normalizeSinglesStatus(rawStatus) === 'active';
}

/**
 * @param {unknown} rawStatus
 * @returns {boolean}
 */
export function isSinglesStatusUnder18(rawStatus) {
  return normalizeSinglesStatus(rawStatus) === 'under18';
}

/**
 * @param {unknown} rawStatus
 * @returns {boolean}
 */
export function isSinglesStatusNew(rawStatus) {
  return normalizeSinglesStatus(rawStatus) === SINGLES_STATUS_NEW;
}

/**
 * @param {unknown} rawStatus
 * @param {unknown} [memberCategory] RegularMember may log in with any status
 *   except the force-logout statuses, which always block.
 * @returns {boolean}
 */
export function isSinglesStatusLoginAllowed(rawStatus, memberCategory) {
  if (isSinglesStatusForceLogout(rawStatus)) return false;
  if (isRegularMemberCategory(memberCategory)) return true;
  return SINGLES_LOGIN_ALLOWED_STATUSES.includes(normalizeSinglesStatus(rawStatus));
}

/**
 * @param {unknown} rawStatus
 * @param {unknown} [memberCategory]
 * @returns {string | null} Error text when login is blocked; null when allowed.
 */
export function singlesStatusLoginRejectMessage(rawStatus, memberCategory) {
  if (isSinglesStatusLoginAllowed(rawStatus, memberCategory)) return null;
  return singlesStatusBlockedMessage(rawStatus);
}
