import { isRegularMemberCategory } from './memberCategory.js';

/** @typedef {'active' | 'cancel' | 'suspend' | 'pause' | 'abandon' | 'unknown' | 'other' | 'blank' | 'inactive' | 'under18'} SinglesStatus */

/** Cycle order matches helloworldjunktest.singles_status enum sort order. */
export const SINGLES_STATUS_VALUES = Object.freeze([
  'active',
  'cancel',
  'suspend',
  'pause',
  'abandon',
  'unknown',
  'other',
  'blank',
  'inactive',
  'under18'
]);

/** Exact login error when singles.status = under18 (product copy). */
export const UNDER18_LOGIN_ERROR = 'This site are for over 18 years of age required';

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

export const SINGLES_LOGIN_ALLOWED_STATUSES = Object.freeze(['active', 'pause']);

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
 * @param {unknown} [memberCategory] RegularMember may log in even when status is inactive / not active
 *   — except under18, which always blocks.
 * @returns {boolean}
 */
export function isSinglesStatusLoginAllowed(rawStatus, memberCategory) {
  if (isSinglesStatusUnder18(rawStatus)) return false;
  if (isRegularMemberCategory(memberCategory)) return true;
  const normalized = normalizeSinglesStatus(rawStatus);
  return normalized != null && SINGLES_LOGIN_ALLOWED_STATUSES.includes(normalized);
}

/**
 * @param {unknown} rawStatus
 * @param {unknown} [memberCategory]
 * @returns {string | null} Error text when login is blocked; null when allowed.
 */
export function singlesStatusLoginRejectMessage(rawStatus, memberCategory) {
  if (isSinglesStatusUnder18(rawStatus)) return UNDER18_LOGIN_ERROR;
  if (!isSinglesStatusLoginAllowed(rawStatus, memberCategory)) {
    return 'Your account is not active. Please contact support.';
  }
  return null;
}
