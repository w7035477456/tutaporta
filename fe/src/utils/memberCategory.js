/** Cycle order matches helloworldjunktest.member_category_enum sort order. */
export const MEMBER_CATEGORY_VALUES = Object.freeze([
  'Public',
  'Admin',
  'DemoUser',
  'PilotUser',
  'RegularMember',
  'AnyMember'
]);

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeMemberCategory(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  return MEMBER_CATEGORY_VALUES.find((entry) => entry.toLowerCase() === lower) ?? null;
}

/**
 * @param {unknown} current
 * @returns {string}
 */
export function nextMemberCategory(current) {
  const normalized = normalizeMemberCategory(current) ?? 'Public';
  const index = MEMBER_CATEGORY_VALUES.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % MEMBER_CATEGORY_VALUES.length;
  return MEMBER_CATEGORY_VALUES[nextIndex];
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatMemberCategoryLabel(raw) {
  const normalized = normalizeMemberCategory(raw);
  if (normalized) return normalized;
  const fallback = String(raw ?? '').trim();
  return fallback || '—';
}

export function isPilotUserCategory(raw) {
  return normalizeMemberCategory(raw) === 'PilotUser';
}

export function isDemoUserCategory(raw) {
  return normalizeMemberCategory(raw) === 'DemoUser';
}

export function isRegularMemberCategory(raw) {
  return normalizeMemberCategory(raw) === 'RegularMember';
}

/** DemoUser / RegularMember: full menus; skip mandatory profile-photo setup gate. */
export function isInitialSetupBypassMemberCategory(raw) {
  return isDemoUserCategory(raw) || isRegularMemberCategory(raw);
}
