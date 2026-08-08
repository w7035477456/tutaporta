import pool from '../db/connection.js';

/** Reserved singles row for global tools login (login id "admin"). Not shown in member listings. */
export const SYSTEM_TOOLS_ADMIN_EMAIL = 'tools-admin@vsingles.internal';
/** Reserved member_id — never delete or mutate via admin tools (see addSystemToolsAdminSinglesRow.sql). */
export const SYSTEM_TOOLS_ADMIN_MEMBER_ID = 999999;

const PROTECTED_SINGLES_MUTATION_ERROR =
  'System tools admin account (member_id 999999) cannot be deleted or modified.';

let cachedSystemToolsAdminSinglesId = null;

export function clearSystemToolsAdminSinglesIdCache() {
  cachedSystemToolsAdminSinglesId = null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 * @returns {Promise<{ singles_id: number, email: string, alias: string, member_category: string } | null>}
 */
export async function lookupSystemToolsAdminSingles(db = pool) {
  const { rows } = await db.query(
    `SELECT singles_id, email, alias, member_category
     FROM helloworldjunktest.singles
     WHERE lower(email::text) = lower($1::text)
     LIMIT 1`,
    [SYSTEM_TOOLS_ADMIN_EMAIL]
  );
  const row = rows[0];
  if (!row?.singles_id) return null;
  return {
    singles_id: Number(row.singles_id),
    email: String(row.email ?? SYSTEM_TOOLS_ADMIN_EMAIL),
    alias: String(row.alias ?? 'Admin'),
    member_category: String(row.member_category ?? 'Admin')
  };
}

/** @param {import('pg').Pool | import('pg').PoolClient} [db] */
export async function getSystemToolsAdminSinglesId(db = pool) {
  if (cachedSystemToolsAdminSinglesId != null) return cachedSystemToolsAdminSinglesId;
  const row = await lookupSystemToolsAdminSingles(db);
  cachedSystemToolsAdminSinglesId =
    row?.singles_id != null && Number.isFinite(Number(row.singles_id)) ? Number(row.singles_id) : null;
  return cachedSystemToolsAdminSinglesId;
}

export function isSystemToolsAdminSinglesId(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  if (cachedSystemToolsAdminSinglesId != null) return id === cachedSystemToolsAdminSinglesId;
  return false;
}

export function isSystemToolsAdminMemberId(memberId) {
  const n = Number(memberId);
  return Number.isFinite(n) && Math.trunc(n) === SYSTEM_TOOLS_ADMIN_MEMBER_ID;
}

/** @param {import('pg').Pool | import('pg').PoolClient} [db] */
export async function isProtectedSystemToolsAdminSinglesId(singlesId, db = pool) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return false;

  const sysId = await getSystemToolsAdminSinglesId(db);
  if (sysId != null && id === sysId) return true;

  const { rows } = await db.query(
    `SELECT member_id
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [id]
  );
  return isSystemToolsAdminMemberId(rows[0]?.member_id);
}

/**
 * @param {import('express').Response} res
 * @param {number} singlesId
 * @param {import('pg').Pool | import('pg').PoolClient} [db]
 * @returns {Promise<boolean>} true when delete/mutation may proceed
 */
export async function allowSinglesMutationForId(res, singlesId, db = pool) {
  if (!(await isProtectedSystemToolsAdminSinglesId(singlesId, db))) return true;
  res.status(403).json({ error: PROTECTED_SINGLES_MUTATION_ERROR });
  return false;
}

/** SQL fragment to hide system tools admin from member listings. */
export function buildExcludeSystemToolsAdminWhereSql(alias = 's') {
  return `lower(COALESCE(${alias}.email::text, '')) <> lower('${SYSTEM_TOOLS_ADMIN_EMAIL.replace(/'/g, "''")}')`;
}
