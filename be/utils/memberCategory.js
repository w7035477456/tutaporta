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
export function normalizeMemberCategoryEnum(raw) {
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
  const normalized = normalizeMemberCategoryEnum(current) ?? 'Public';
  const index = MEMBER_CATEGORY_VALUES.indexOf(normalized);
  const nextIndex = index < 0 ? 0 : (index + 1) % MEMBER_CATEGORY_VALUES.length;
  return MEMBER_CATEGORY_VALUES[nextIndex];
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatMemberCategoryLabel(raw) {
  const normalized = normalizeMemberCategoryEnum(raw);
  if (normalized) return normalized;
  const fallback = String(raw ?? '').trim();
  return fallback || '—';
}

export function isDemoUserCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'DemoUser';
}

export function isRegularMemberCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'RegularMember';
}

/** DemoUser / RegularMember: skip mandatory setup / IDV nav locks. */
export function isInitialSetupBypassMemberCategory(raw) {
  return isDemoUserCategory(raw) || isRegularMemberCategory(raw);
}
