/** Cycle order matches helloworldjunktest.member_category_enum sort order. */
export const MEMBER_CATEGORY_VALUES = Object.freeze([
  'PUBLIC',
  'ADMIN',
  'DEMOUSER',
  'PILOTUSER',
  'REGULARMEMBER',
  'ANYMEMBER'
]);

/** Legacy PascalCase / mixed-case labels → canonical uppercase enum. */
const MEMBER_CATEGORY_ALIASES = Object.freeze({
  public: 'PUBLIC',
  admin: 'ADMIN',
  demouser: 'DEMOUSER',
  pilotuser: 'PILOTUSER',
  regularmember: 'REGULARMEMBER',
  anymember: 'ANYMEMBER',
  allmember: 'ANYMEMBER'
});

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeMemberCategoryEnum(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const key = value.toLowerCase();
  return MEMBER_CATEGORY_ALIASES[key] ?? null;
}

/**
 * @param {unknown} current
 * @returns {string}
 */
export function nextMemberCategory(current) {
  const normalized = normalizeMemberCategoryEnum(current) ?? 'PUBLIC';
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
  return normalizeMemberCategoryEnum(raw) === 'DEMOUSER';
}

export function isRegularMemberCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'REGULARMEMBER';
}

export function isAnyMemberCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'ANYMEMBER';
}

/** DemoUser / RegularMember: skip mandatory setup / IDV nav locks. */
export function isInitialSetupBypassMemberCategory(raw) {
  return isDemoUserCategory(raw) || isRegularMemberCategory(raw);
}
