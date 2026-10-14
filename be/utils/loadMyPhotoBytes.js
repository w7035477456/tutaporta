import fs from 'fs';
import pool from '../db/connection.js';
import {
  buildPhotoSearchFolders,
  getPhotoFolder,
  resolvePhotoFilePathInFolders
} from './photoFilePath.js';
import { loadMemberIdForSinglesOrFallback } from './tutaDatesMemberPaths.js';

/**
 * Load on-disk bytes for one album photo owned by the member.
 * @param {number} singlesId
 * @param {number} photosId
 * @returns {Promise<Buffer>}
 */
export async function loadMyPhotoBytes(singlesId, photosId) {
  const result = await pool.query(
    `SELECT p.photos_id, p.singles_id, p.file_extension, p.photo_file_name, p.file_path, s.member_id
     FROM outdateddbsnapshotoct2024.photos p
     JOIN outdateddbsnapshotoct2024.singles s ON s.singles_id = p.singles_id
     WHERE p.photos_id = $1 AND p.singles_id = $2
     LIMIT 1`,
    [photosId, singlesId]
  );
  if (!result.rows.length) {
    throw new Error('Photo not found for this user');
  }
  const row = result.rows[0];
  const memberId = row.member_id ?? (await loadMemberIdForSinglesOrFallback(singlesId));
  const searchFolders = buildPhotoSearchFolders({ filePathFromDb: row.file_path, memberId });
  if (!searchFolders.length && !getPhotoFolder()) {
    throw new Error('Tuta Dates photo storage is not configured');
  }
  const ext = String(row.file_extension || 'jpg').replace(/^\./, '');
  const fullPath = resolvePhotoFilePathInFolders(searchFolders, row.photo_file_name, photosId, ext);
  if (!fullPath) {
    throw new Error('Photo file not found on server');
  }
  return fs.readFileSync(fullPath);
}
