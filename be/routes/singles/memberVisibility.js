function parseAllowedMemberCategories() {
  const raw = process.env.SHOW_MEMBER_CATEGORY || '';
  return String(raw)
    .split(',')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
}

/** SQL fragment: singles.status must be active (helloworldjunktest.singles_status enum). */
export function buildSinglesActiveStatusWhereSql(alias = 's') {
  return `LOWER(COALESCE(TRIM(${alias}.status::text), 'blank')) = 'active'`;
}

export function buildSinglesVisibilityWhereSql(alias = 's', paramIndex = 1) {
  const activeStatusSql = buildSinglesActiveStatusWhereSql(alias);
  const allowedCategories = parseAllowedMemberCategories();
  if (!allowedCategories.length) {
    return {
      whereSql: activeStatusSql,
      params: []
    };
  }
  return {
    whereSql: `${activeStatusSql} AND LOWER(COALESCE(TRIM(${alias}.member_category::text), '')) = ANY($${paramIndex}::text[])`,
    params: [allowedCategories]
  };
}

