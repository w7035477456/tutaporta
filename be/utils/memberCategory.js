/** Cycle order matches outdateddbsnapshotoct2024.member_category_enum sort order. */
export const MEMBER_CATEGORY_VALUES = Object.freeze([
  'PUBLIC',
  'ADMIN',
  'DEMOUSER',
  'PILOTUSER',
  'REGULARMEMBER',
  'ANYMEMBER',
  'ANYMEMBER-R',
  'ANYMEMBER-S'
]);

/** Signed up with a Raffle Refer Code (R####). */
export const ANYMEMBER_RAFFLE_REFER = 'ANYMEMBER-R';
/** Signed up with a Signup Refer Code (A####, not A0000). */
export const ANYMEMBER_SIGNUP_REFER = 'ANYMEMBER-S';
/** Every category that behaves exactly like ANYMEMBER. */
export const ANYMEMBER_CATEGORIES = Object.freeze(['ANYMEMBER', ANYMEMBER_RAFFLE_REFER, ANYMEMBER_SIGNUP_REFER]);

/** Legacy PascalCase / mixed-case labels → canonical uppercase enum. */
const MEMBER_CATEGORY_ALIASES = Object.freeze({
  public: 'PUBLIC',
  admin: 'ADMIN',
  demouser: 'DEMOUSER',
  pilotuser: 'PILOTUSER',
  regularmember: 'REGULARMEMBER',
  anymember: 'ANYMEMBER',
  allmember: 'ANYMEMBER',
  'anymember-r': 'ANYMEMBER-R',
  'anymember-s': 'ANYMEMBER-S'
});

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeMemberCategoryEnum(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (MEMBER_CATEGORY_VALUES.includes(upper)) return upper;
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

export function isAdminMemberCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'ADMIN';
}

export function isDemoUserCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'DEMOUSER';
}

export function isRegularMemberCategory(raw) {
  return normalizeMemberCategoryEnum(raw) === 'REGULARMEMBER';
}

/** ANYMEMBER, ANYMEMBER-R or ANYMEMBER-S. */
export function isAnyMemberCategory(raw) {
  return ANYMEMBER_CATEGORIES.includes(normalizeMemberCategoryEnum(raw));
}

/** DemoUser / RegularMember: skip mandatory setup / IDV nav locks. */
export function isInitialSetupBypassMemberCategory(raw) {
  return isDemoUserCategory(raw) || isRegularMemberCategory(raw);
}
