/**
 * Canonical `requests` column helpers — brief_bio_* and full_bio_* only.
 * Legacy names (basic_info_*, basic_inf_*, details_info_*) are not referenced in app code.
 */

/** @param {Set<string>} has - request table columns */
/** @param {string} [tableAlias] */
export function briefBioRequestSelectExpr(has, tableAlias = 'r') {
  const t = tableAlias;
  if (has.has('brief_bio_request')) {
    return `LOWER(BTRIM(COALESCE(${t}.brief_bio_request::text, 'notrequested')))`;
  }
  return `'notrequested'`;
}

/** @param {Set<string>} has */
/** @param {string} [tableAlias] */
export function briefBioApprovalSelectExpr(has, tableAlias = 'r') {
  const t = tableAlias;
  if (has.has('brief_bio_request_approval')) {
    return `${t}.brief_bio_request_approval`;
  }
  return 'NULL';
}

/** @param {Set<string>} has */
/** @param {string} [tableAlias] */
export function fullBioRequestSelectExpr(has, tableAlias = 'r') {
  const t = tableAlias;
  if (has.has('full_bio_request')) {
    return `LOWER(BTRIM(COALESCE(${t}.full_bio_request::text, 'notrequested')))`;
  }
  return `'notrequested'`;
}

/** @param {Set<string>} has */
/** @param {string} [tableAlias] */
export function fullBioApprovalSelectExpr(has, tableAlias = 'r') {
  const t = tableAlias;
  if (has.has('full_bio_request_approval')) {
    return `${t}.full_bio_request_approval`;
  }
  return 'NULL';
}
