import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';

export async function resolveBioSchema() {
  const candidates = [...new Set([getDBSchema(), 'helloworldjunktest', 'public'].filter(Boolean))];
  for (const schemaName of candidates) {
    const r = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name IN ('vet_bio', 'misc_bio')
       GROUP BY table_schema
       HAVING COUNT(*) = 2
       LIMIT 1`,
      [schemaName]
    );
    if (r.rows.length) return schemaName;
  }
  return 'helloworldjunktest';
}

export function sqlIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export async function loadTableColumns(schemaName, tableName) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schemaName, tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
}

/** vet_bio varchar columns editable from Brief Bio draft keys (briefBio.*). Age uses smallint separately. */
export const VET_BIO_BRIEF_FIELD_KEYS = new Set(['firstname', 'middlename', 'lastname', 'current_city']);

/** vet_bio columns editable from Full Bio draft keys (fullBio.*). */
export const VET_BIO_FULL_FIELD_KEYS = new Set([
  'credit_score_grade',
  'company_domain_name',
  'current_company',
  'job_title',
  'college_name',
  'highest_degree_completed',
  'degree_graduation_date',
  'linkedin_url'
]);

export const MISC_BIO_FIELD_KEYS = new Set([
  'favorite_hobbies',
  'favorite_food',
  'favorite_drinks',
  'favorite_desserts',
  'favorite_movie',
  'favorite_music',
  'favorite_spectator_sport_team',
  'favorite_quotes',
  'favorite_books',
  'favorite_video_games',
  'favorite_vacation_places',
  'favorite_memories',
  'children_info',
  'religion',
  'marriage_history',
  'ethnicity',
  'country_of_birth'
]);

/** FK column on vet_bio / misc_bio → helloworldjunktest.singles.singles_id */
export const BIO_SINGLES_FK_COLUMN = 'singles_id';

/**
 * Upsert one vet_bio or misc_bio row keyed by singles_id.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function upsertBioRow(db, schemaName, tableName, singlesId, columns, allowedColumns) {
  const entries = Object.entries(columns).filter(([column]) => allowedColumns.has(column));
  if (!entries.length) return false;

  const schema = sqlIdent(schemaName);
  const table = sqlIdent(tableName);
  const fk = sqlIdent(BIO_SINGLES_FK_COLUMN);
  const columnNames = [BIO_SINGLES_FK_COLUMN, ...entries.map(([column]) => column)];
  const values = [singlesId, ...entries.map(([, value]) => value)];
  const valueRefs = values.map((_, index) => `$${index + 1}`);
  const conflictUpdates = entries
    .map(([column]) => `${sqlIdent(column)} = EXCLUDED.${sqlIdent(column)}`)
    .join(', ');

  const sql = `INSERT INTO ${schema}.${table} (${columnNames.map(sqlIdent).join(', ')})
    VALUES (${valueRefs.join(', ')})
    ON CONFLICT (${fk}) DO UPDATE SET ${conflictUpdates}`;

  await db.query(sql, values);
  return true;
}
