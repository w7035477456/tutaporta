import { isRegularMemberCategory } from './memberCategory.js';

/** @typedef {'active' | 'cancel' | 'suspend' | 'pause' | 'abandon' | 'unknown' | 'other' | 'blank' | 'inactive'} SinglesStatus */

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
  'inactive'
]);

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
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const SINGLES_LOGIN_ALLOWED_STATUSES = Object.freeze(['active', 'pause']);

/**
 * @param {unknown} rawStatus
 * @param {unknown} [memberCategory] RegularMember may log in even when status is inactive / not active
 * @returns {boolean}
 */
export function isSinglesStatusLoginAllowed(rawStatus, memberCategory) {
  if (isRegularMemberCategory(memberCategory)) return true;
  const normalized = normalizeSinglesStatus(rawStatus);
  return normalized != null && SINGLES_LOGIN_ALLOWED_STATUSES.includes(normalized);
}
