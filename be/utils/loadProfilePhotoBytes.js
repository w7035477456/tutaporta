import fs from 'fs';
import pool from '../db/connection.js';
import {
  buildPhotoSearchFolders,
  getPhotoFolder,
  resolvePhotoFilePathInFolders
} from './photoFilePath.js';
import { loadMemberIdForSinglesOrFallback } from './tutaDatesMemberPaths.js';

/**
 * Loads the authenticated member's profile photo bytes from disk.
 * @param {number} singlesId
 * @returns {Promise<Buffer>}
 */
export async function loadProfilePhotoBytes(singlesId) {
  const result = await pool.query(
    `SELECT s.profile_image_fk, s.member_id, p.file_extension, p.photo_file_name, p.file_path, p.singles_id AS photo_owner_id
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

  const memberId = row.member_id ?? (await loadMemberIdForSinglesOrFallback(singlesId));
  const searchFolders = buildPhotoSearchFolders({ filePathFromDb: row.file_path, memberId });
  if (!searchFolders.length && !getPhotoFolder()) {
    throw new Error('Tuta Dates photo storage is not configured');
  }

  const ext = String(row.file_extension || 'jpg').replace(/^\./, '');
  const fullPath = resolvePhotoFilePathInFolders(searchFolders, row.photo_file_name, profilePhotoId, ext);
  if (!fullPath) {
    throw new Error('Profile photo file not found on server');
  }
  return fs.readFileSync(fullPath);
}
