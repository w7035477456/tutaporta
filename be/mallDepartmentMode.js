import { normalizeMemberCategoryEnum } from './utils/memberCategory.js';

/**
 * Mall tile visibility from ~/.ssh/be/.env using member-category keys
 * (loaded by loadEnv.js → process.env).
 *
 * Supported keys (uppercase, match DB singles.member_category):
 * - PUBLIC
 * - DEMOUSER
 * - PILOTUSER
 * - ADMIN
 * - REGULARMEMBER
 * - ANYMEMBER
 *
 * Values (case-insensitive):
 * - show_all
 * - show_vsingles
 * - show_eMarketPlace
 * - comma list, e.g. show_vsingles,show_eMarketPlace
 */

const SHOW_ALL = 'all';
const VSINGLES_ONLY = 'vsingles_only';
const EMARKETPLACE_ONLY = 'emarketplace_only';
const VSINGLES_AND_EMARKETPLACE = 'vsingles_and_emarketplace';

function normalizeMode(raw) {
  const tokens = String(raw ?? '')
    .split(',')
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return SHOW_ALL;
  if (tokens.includes('show_all')) return SHOW_ALL;

  const hasVSingles = tokens.includes('show_vsingles');
  const hasEMarketPlace = tokens.includes('show_emarketplace');

  if (hasVSingles && hasEMarketPlace) return VSINGLES_AND_EMARKETPLACE;
  if (hasVSingles) return VSINGLES_ONLY;
  if (hasEMarketPlace) return EMARKETPLACE_ONLY;
  return SHOW_ALL;
}

/** Read uppercase member category key from env (legacy PascalCase keys still accepted). */
function envForMemberCategory(memberCategory) {
  const normalized = normalizeMemberCategoryEnum(memberCategory);
  const category = normalized ?? String(memberCategory ?? '').trim().toUpperCase();
  if (!category) return '';
  return process.env[category] ?? '';
}

/**
 * @param {unknown} memberCategory — DB `singles.member_category` (member_category_enum)
 * @returns {'all' | 'vsingles_only' | 'emarketplace_only' | 'vsingles_and_emarketplace'}
 */
export function getMallDepartmentMode(memberCategory) {
  return normalizeMode(envForMemberCategory(memberCategory));
}
