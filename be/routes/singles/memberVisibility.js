function parseAllowedMemberCategories() {
  const raw = process.env.SHOW_MEMBER_CATEGORY || '';
  return String(raw)
    .split(',')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * SQL fragment: singles.status must be active (helloworldjunktest.singles_status enum).
 * Inactive / blank / suspend / pause / etc. must not appear on
 * All Singles, Picks & Posts, or Acquaint. & Buddies listings.
 */
export function buildSinglesActiveStatusWhereSql(alias = 's') {
  return `LOWER(COALESCE(TRIM(${alias}.status::text), 'blank')) = 'active'`;
}

/** Categories always eligible when status=active (CreateNewMember.sh). */
const ALWAYS_VISIBLE_MEMBER_CATEGORIES = ['regularmember', 'anymember'];

export function buildSinglesVisibilityWhereSql(alias = 's', paramIndex = 1) {
  const activeStatusSql = buildSinglesActiveStatusWhereSql(alias);
  const allowedCategories = parseAllowedMemberCategories();
  if (!allowedCategories.length) {
    return {
      whereSql: activeStatusSql,
      params: []
    };
  }
  const merged = [...new Set([...allowedCategories, ...ALWAYS_VISIBLE_MEMBER_CATEGORIES])];
  return {
    whereSql: `${activeStatusSql} AND LOWER(COALESCE(TRIM(${alias}.member_category::text), '')) = ANY($${paramIndex}::text[])`,
    params: [merged]
  };
}

