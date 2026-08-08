import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { withSchemaCache } from '../../utils/dbSchemaMetadataCache.js';

/**
 * Pick a PostgreSQL schema whose `requests` table should drive request flows.
 * Prefer DB_SCHEMA when that table includes basic approval columns; otherwise
 * fall back to `helloworldjunktest` so we do not read an older
 * duplicate requests table with boolean-only defaults while the live
 * varchar approval values live in the app schema (which would look like
 * "Not Responded" on the U-request-others page).
 */
export async function resolveRequestsAppSchema() {
  const preferred = getDBSchema();
  return withSchemaCache(`resolveRequestsAppSchema:${preferred}`, () => resolveRequestsAppSchemaUncached(preferred));
}

async function resolveRequestsAppSchemaUncached(preferred) {
  const candidates = [...new Set([preferred, 'helloworldjunktest'].filter(Boolean))];

  const hasRequestsWithBasicApproval = async (schemaName) => {
    const r = await pool.query(
      `SELECT 1
       FROM information_schema.tables t
       WHERE t.table_schema = $1
         AND t.table_name = 'requests'
         AND EXISTS (
           SELECT 1
           FROM information_schema.columns c
           WHERE c.table_schema = t.table_schema
             AND c.table_name = 'requests'
             AND c.column_name IN ('brief_bio_request_approval')
         )
       LIMIT 1`,
      [schemaName]
    );
    return r.rows.length > 0;
  };

  const hasRequestsTable = async (schemaName) => {
    const r = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = 'requests'
       LIMIT 1`,
      [schemaName]
    );
    return r.rows.length > 0;
  };

  for (const schemaName of candidates) {
    if (await hasRequestsWithBasicApproval(schemaName)) {
      return schemaName;
    }
  }

  for (const schemaName of candidates) {
    if (await hasRequestsTable(schemaName)) {
      return schemaName;
    }
  }

  return preferred;
}
