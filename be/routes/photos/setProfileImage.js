import path from 'path';
import os from 'os';
import pool, { getDBSchema } from '../../db/connection.js';
import { sqlBooleanEnumLiteral } from '../../utils/booleanEnum.js';
import fs from 'fs';
import { activateSinglesStatusOnProfilePhoto } from '../../utils/activateSinglesStatusOnProfilePhoto.js';
import { buildProfilePercentMatchZeroSetClauses } from '../../utils/zeroSinglesProfilePercentMatches.js';
import { loadTableColumns, sqlIdent } from '../singles/checkrBioReviewDb.js';
import { isAdminImpersonationSession } from '../../utils/adminAuth.js';

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

/** Folder from VSINGLES_PHOTO_FOLDER only. Expands ~. */
function getPhotoFolder() {
  const folder = process.env.VSINGLES_PHOTO_FOLDER;
  if (!folder || typeof folder !== 'string' || !folder.trim()) return null;
  const t = folder.trim().replace(/\/+$/, '');
  const expanded = t.startsWith('~/') ? path.join(os.homedir(), t.slice(2)) : t;
  return expanded ? expanded + '/' : null;
}

function logPhotoDirStats(label) {
  const folder = getPhotoFolder();
  if (!folder) {
    console.log('[setProfileImage]', label, 'VSINGLES_PHOTO_FOLDER is not set');
    return;
  }
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    console.log('[setProfileImage]', label, 'folder =', folder, 'fileCount =', files.length);
  } catch (e) {
    console.error('[setProfileImage]', label, 'failed to read folder', folder, e.message);
  }
}

/**
 * POST /api/profilePhoto
 * Body: { photos_id: number } where photos_id is helloworldjunktest.photos.photos_id.
 * Sets singles.profile_image_fk for the authenticated single, only if the photo belongs to them.
 */
export async function setProfileImage(req, res) {
  try {
    const singlesId = req.auth?.singles_id;
    if (!singlesId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const photosId = parseInt(req.body?.photos_id, 10);
    if (Number.isNaN(photosId) || photosId < 1) {
      return res.status(400).json({ error: 'Invalid photo id' });
    }

    console.log('[setProfileImage] START', { singlesId, photosId });

    const client = await pool.connect();
    try {
      const photoRow = await client.query(
        `SELECT photos_id
         FROM helloworldjunktest.photos
         WHERE photos_id = $1 AND singles_id = $2`,
        [photosId, singlesId]
      );

      if (photoRow.rows.length === 0) {
        console.log('[setProfileImage] photo not found for user', { singlesId, photosId });
        return res.status(404).json({ error: 'Photo not found for this user' });
      }

      const schemaName = getDBSchema();
      const singlesColumns = await loadTableColumns(schemaName, 'singles');
      const skipProfileChangeSideEffects = isAdminImpersonationSession(req.auth);
      const percentMatchZeroSql = skipProfileChangeSideEffects
        ? []
        : buildProfilePercentMatchZeroSetClauses(singlesColumns);
      const initialSetupDoneSql = await resolveInitialSetupDoneCaseSql(client);
      const setClauses = [
        'profile_image_fk = $1',
        initialSetupDoneSql,
        ...percentMatchZeroSql
      ];
      if (percentMatchZeroSql.length && singlesColumns.has('updated_at')) {
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
      }
      const schema = sqlIdent(schemaName);
      await client.query(
        `UPDATE ${schema}.singles
         SET ${setClauses.join(', ')}
         WHERE singles_id = $2`,
        [photosId, singlesId]
      );
      await activateSinglesStatusOnProfilePhoto(client, singlesId);
      console.log('[setProfileImage] updated singles.profile_image_fk, initial_setup_done, profile percent matches', {
        singlesId,
        photosId,
        zeroedPercentMatches: percentMatchZeroSql.length > 0,
        skipProfileChangeSideEffects
      });
    } finally {
      client.release();
    }

    logPhotoDirStats('after setProfileImage');
    res.status(204).send();
  } catch (err) {
    console.error('Set profile image error:', err);
    res.status(500).json({ error: 'Failed to set profile image' });
  }
}


