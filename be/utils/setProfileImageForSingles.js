import pool, { getDBSchema } from '../db/connection.js';
import { sqlBooleanEnumLiteral } from './booleanEnum.js';
import { activateSinglesStatusOnProfilePhoto } from './activateSinglesStatusOnProfilePhoto.js';
import { zeroSinglesProfilePercentMatches } from './zeroSinglesProfilePercentMatches.js';

let cachedInitialSetupDoneUdt = null;

function buildInitialSetupDoneCaseSql(udtName) {
  if (udtName === 'boolean_enum') {
    const trueLiteral = sqlBooleanEnumLiteral(true);
    return `initial_setup_done = CASE
      WHEN NOT (LOWER(BTRIM(initial_setup_done::text)) = 'true') THEN ${trueLiteral}
      ELSE initial_setup_done
    END`;
  }
  return `initial_setup_done = CASE
    WHEN COALESCE(initial_setup_done, false) IS NOT TRUE THEN true
    ELSE initial_setup_done
  END`;
}

async function resolveInitialSetupDoneCaseSql(client) {
  if (cachedInitialSetupDoneUdt) {
    return buildInitialSetupDoneCaseSql(cachedInitialSetupDoneUdt);
  }
  const schemaName = getDBSchema();
  const { rows } = await client.query(
    `SELECT udt_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'singles'
       AND column_name = 'initial_setup_done'
     LIMIT 1`,
    [schemaName]
  );
  cachedInitialSetupDoneUdt = rows[0]?.udt_name || 'bool';
  return buildInitialSetupDoneCaseSql(cachedInitialSetupDoneUdt);
}

/** Set profile_image_fk when photo belongs to member (used after mobile QR upload). */
export async function setProfileImageForSingles(singlesId, photosId) {
  const client = await pool.connect();
  try {
    const photoRow = await client.query(
      `SELECT photos_id
       FROM helloworldjunktest.photos
       WHERE photos_id = $1 AND singles_id = $2
       LIMIT 1`,
      [photosId, singlesId]
    );
    if (!photoRow.rows.length) {
      throw new Error('Photo not found for this user');
    }

    const initialSetupDoneSql = await resolveInitialSetupDoneCaseSql(client);
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET profile_image_fk = $1, ${initialSetupDoneSql}
       WHERE singles_id = $2`,
      [photosId, singlesId]
    );
    await zeroSinglesProfilePercentMatches(client, singlesId);
    await activateSinglesStatusOnProfilePhoto(client, singlesId);
  } finally {
    client.release();
  }
}
