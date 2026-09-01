import { getPhotoFolder, listMemberPhotoFilesOnDisk, listPhotoFolderFilesForMemberId, unlinkMemberPhotoFilesFromDisk } from './photoFilePath.js';
import fs from 'fs';

const LOG_PREFIX = '[deletePhotoFromFolder]';
const PHOTOS_TABLE = 'helloworldjunktest.photos';

function photoFolderLabel() {
  const folder = getPhotoFolder();
  if (folder) return folder.replace(/\/+$/, '');
  const envRaw = String(process.env.TUTADATES_PHOTO_FOLDER ?? '').trim();
  return envRaw || '(TUTADATES_PHOTO_FOLDER not set)';
}

export async function fetchPhotoRowsForSinglesId(pool, singlesId) {
  const { rows } = await pool.query(
    `SELECT photos_id, photo_file_name, file_extension
     FROM ${PHOTOS_TABLE}
     WHERE singles_id = $1`,
    [singlesId]
  );
  return rows;
}

export async function fetchSinglesMemberId(pool, singlesId) {
  const { rows } = await pool.query(
    `SELECT member_id FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
    [singlesId]
  );
  const memberId = rows[0]?.member_id;
  return memberId == null ? null : memberId;
}

function collectPhotoFolderFilesForSingles(pool, singlesId) {
  return Promise.all([
    fetchPhotoRowsForSinglesId(pool, singlesId),
    fetchSinglesMemberId(pool, singlesId)
  ]).then(([photoRows, memberId]) => {
    const allFiles = new Set();
    for (const row of photoRows) {
      for (const filePath of listMemberPhotoFilesOnDisk(row)) {
        allFiles.add(filePath);
      }
    }
    for (const filePath of listPhotoFolderFilesForMemberId(memberId)) {
      allFiles.add(filePath);
    }
    return { photoRows, memberId, allFiles };
  });
}

/**
 * Count on-disk files in TUTADATES_PHOTO_FOLDER tied to one member's photos rows.
 * @param {import('pg').Pool} pool
 * @param {number} singlesId
 */
export async function countPhotoFolderFilesForSinglesId(pool, singlesId) {
  const label = photoFolderLabel();
  const photoFolder = getPhotoFolder();
  if (!photoFolder) {
    return { label, fileCount: null, missing: true };
  }

  const { allFiles } = await collectPhotoFolderFilesForSingles(pool, singlesId);
  return { label, fileCount: allFiles.size, missing: false };
}

/**
 * Remove on-disk files for all photos rows of one singles_id (DB rows unchanged).
 * @param {import('pg').Pool} pool
 * @param {number} singlesId
 */
export async function deletePhotoFolderFilesForSinglesId(pool, singlesId) {
  const { photoRows, allFiles } = await collectPhotoFolderFilesForSingles(pool, singlesId);
  const photoFolder = getPhotoFolder();
  const removed = new Set();

  const rowResult = deletePhotosFromFolder(photoRows);
  for (const filePath of rowResult.removed) removed.add(filePath);

  for (const filePath of allFiles) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removed.add(filePath);
      }
    } catch {
      // ignore per-file unlink errors
    }
  }

  return {
    removed: [...removed],
    photoFolder: photoFolder || rowResult.photoFolder,
    rowsProcessed: photoRows.length
  };
}

/**
 * Remove on-disk files for one helloworldjunktest.photos row from TUTADATES_PHOTO_FOLDER
 * before the photos row is deleted from Postgres.
 * Deletes main image variants and matching {base}orig.jpg.
 *
 * @param {{ photos_id?: number | string, photo_file_name?: string | null, file_extension?: string | null }} photoRow
 * @returns {{ removed: string[], photoFolder: string }}
 */
export function deletePhotoFromFolder(photoRow) {
  const photosId = Number(photoRow?.photos_id ?? photoRow?.photosId);
  const photoFileName = photoRow?.photo_file_name ?? photoRow?.photoFileName ?? null;

  const { removed, photoFolder } = unlinkMemberPhotoFilesFromDisk(photoRow);

  if (!photoFolder) {
    console.warn(LOG_PREFIX, 'TUTADATES_PHOTO_FOLDER is not set; skipped disk cleanup', { photosId, photoFileName });
  } else if (removed.length === 0) {
    console.log(LOG_PREFIX, 'no files removed', { photosId, photoFileName, photoFolder });
  } else {
    console.log(LOG_PREFIX, 'removed files', { photosId, photoFileName, removed });
  }

  return { removed, photoFolder };
}

/**
 * @param {Array<{ photos_id?: number | string, photo_file_name?: string | null, file_extension?: string | null }>} photoRows
 * @returns {{ removed: string[], photoFolder: string, rowsProcessed: number }}
 */
export function deletePhotosFromFolder(photoRows) {
  const allRemoved = new Set();
  let photoFolder = '';

  for (const row of photoRows) {
    const result = deletePhotoFromFolder(row);
    photoFolder = photoFolder || result.photoFolder;
    for (const path of result.removed) allRemoved.add(path);
  }

  return {
    removed: [...allRemoved],
    photoFolder,
    rowsProcessed: photoRows.length
  };
}
