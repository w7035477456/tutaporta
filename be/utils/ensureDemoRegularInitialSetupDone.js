import { sqlBooleanEnumLiteral } from './booleanEnum.js';
import { getDBSchema } from '../db/connection.js';
import { isInitialSetupBypassMemberCategory } from './memberCategory.js';

export { isInitialSetupBypassMemberCategory };

let cachedInitialSetupDoneUdt = null;

async function resolveInitialSetupDoneUdt(db) {
  if (cachedInitialSetupDoneUdt) return cachedInitialSetupDoneUdt;
  const schemaName = getDBSchema();
  const { rows } = await db.query(
    `SELECT udt_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'singles'
       AND column_name = 'initial_setup_done'
     LIMIT 1`,
    [schemaName]
  );
  cachedInitialSetupDoneUdt = rows[0]?.udt_name || 'bool';
  return cachedInitialSetupDoneUdt;
}

/**
 * DemoUser / RegularMember: always keep singles.initial_setup_done = true.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @param {unknown} [memberCategory] when known, skip category lookup
 * @returns {Promise<boolean>} true when row was updated or already true for bypass category
 */
export async function ensureDemoRegularInitialSetupDone(db, singlesId, memberCategory = undefined) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;

  let category = memberCategory;
  if (category === undefined) {
    const { rows } = await db.query(
      `SELECT member_category::text AS member_category
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [id]
    );
    category = rows[0]?.member_category;
  }
  if (!isInitialSetupBypassMemberCategory(category)) return false;

  const udt = await resolveInitialSetupDoneUdt(db);
  const trueLiteral =
    udt === 'boolean_enum' ? sqlBooleanEnumLiteral(true) : 'true';

  await db.query(
    `UPDATE helloworldjunktest.singles
     SET initial_setup_done = ${trueLiteral},
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
       AND NOT (
         CASE
           WHEN ${udt === 'boolean_enum' ? `LOWER(BTRIM(initial_setup_done::text)) = 'true'` : `COALESCE(initial_setup_done, false) IS TRUE`}
           THEN TRUE
           ELSE FALSE
         END
       )`,
    [id]
  );
  return true;
}
