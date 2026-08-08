import { getDBSchema } from '../db/connection.js';
import { loadTableColumns, sqlIdent } from '../routes/singles/checkrBioReviewDb.js';

const PROFILE_PERCENT_MATCH_COLUMNS = [
  'dl_profile_percent_match',
  'pp_profile_percent_match',
  'live_scan_percent_match'
];

/** SET clause fragments: dl_profile_percent_match = 0, ... */
export function buildProfilePercentMatchZeroSetClauses(singlesColumns) {
  return PROFILE_PERCENT_MATCH_COLUMNS.filter((column) => singlesColumns.has(column)).map(
    (column) => `${column} = 0`
  );
}

/**
 * Zero profile-to-ID match percents in singles when profile photo changes.
 * @returns {Promise<boolean>} true when at least one column was updated
 */
export async function zeroSinglesProfilePercentMatches(client, singlesId) {
  const schemaName = getDBSchema();
  const singlesColumns = await loadTableColumns(schemaName, 'singles');
  const updates = buildProfilePercentMatchZeroSetClauses(singlesColumns);
  if (!updates.length) return false;

  if (singlesColumns.has('updated_at')) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
  }

  const schema = sqlIdent(schemaName);
  await client.query(
    `UPDATE ${schema}.singles SET ${updates.join(', ')} WHERE singles_id = $1`,
    [singlesId]
  );
  return true;
}
