import fs from 'fs';
import pool from '../db/connection.js';
import { getPhotoFolder, resolvePhotoFilePath } from './photoFilePath.js';

/**
 * Loads the authenticated member's profile photo bytes from disk.
 * @param {number} singlesId
 * @returns {Promise<Buffer>}
 */
export async function loadProfilePhotoBytes(singlesId) {
  const result = await pool.query(
    `SELECT s.profile_image_fk, p.file_extension, p.photo_file_name, p.singles_id AS photo_owner_id
     FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.photos p ON p.photos_id = s.profile_image_fk
     WHERE s.singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  if (!result.rows.length) {
    throw new Error('User not found');
  }
  const row = result.rows[0];
  const profilePhotoId = Number(row.profile_image_fk);
  if (!Number.isFinite(profilePhotoId) || profilePhotoId < 1) {
    throw new Error('Profile photo not set. Upload a profile photo before identity verification.');
  }
  if (Number(row.photo_owner_id) !== singlesId) {
    throw new Error('Profile photo not found');
  }

  const photoFolder = getPhotoFolder();
  if (!photoFolder) {
    throw new Error('VSINGLES_PHOTO_FOLDER is not configured');
  }

  const ext = String(row.file_extension || 'jpg').replace(/^\./, '');
  const fullPath = resolvePhotoFilePath(photoFolder, row.photo_file_name, profilePhotoId, ext);
  if (!fullPath) {
    throw new Error('Profile photo file not found on server');
  }
  return fs.readFileSync(fullPath);
}
