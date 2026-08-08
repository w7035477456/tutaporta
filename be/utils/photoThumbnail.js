import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { getPhotoFolder } from './photoFilePath.js';

export const PHOTO_THUMB_SIZE_PX = 256;

export function photoThumbnailFileNameForBase(photoFileNameBase) {
  const base = String(photoFileNameBase ?? '').trim().replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  if (!base) return null;
  return `${base}_thumb.jpg`;
}

/**
 * Create JPEG thumbnail on disk; return filename for photos.photo_thumbnail.
 * @returns {Promise<string|null>}
 */
export async function generateAndSavePhotoThumbnail({ imageBuffer, photoFileNameBase, outputDir }) {
  const base = String(photoFileNameBase ?? '').trim().replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  const dir = String(outputDir ?? '').trim();
  if (!base || !dir || !imageBuffer?.length) return null;

  const thumbFileName = `${base}_thumb.jpg`;
  const thumbFullPath = path.join(dir, thumbFileName);

  try {
    await sharp(imageBuffer)
      .rotate()
      .resize(PHOTO_THUMB_SIZE_PX, PHOTO_THUMB_SIZE_PX, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(thumbFullPath);
    return thumbFileName;
  } catch (err) {
    console.error('[photoThumbnail] generate failed:', err?.message ?? err);
    try {
      if (fs.existsSync(thumbFullPath)) fs.unlinkSync(thumbFullPath);
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}

function expandFolderPath(folder) {
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  return folder.trim().replace(/\/+$/, '');
}

/** Resolve on-disk path for photos.photo_thumbnail. */
export function resolvePhotoThumbnailPath(photoThumbnail, filePathFromDb = null) {
  const fileName = String(photoThumbnail ?? '').trim();
  if (!fileName) return null;

  const folders = [];
  const seen = new Set();
  for (const folder of [filePathFromDb, getPhotoFolder()].filter(Boolean)) {
    const normalized = expandFolderPath(folder);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      folders.push(normalized);
    }
  }

  for (const folder of folders) {
    const candidate = path.resolve(path.join(folder, fileName));
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/** Remove thumbnail JPEG for one photos row. */
export function unlinkPhotoThumbnailFromDisk(row) {
  const removed = [];
  const thumbName = row?.photoThumbnail ?? row?.photo_thumbnail ?? null;
  const resolved = resolvePhotoThumbnailPath(thumbName, row?.filePath ?? row?.file_path ?? null);
  if (!resolved) return removed;

  try {
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      removed.push(resolved);
    }
  } catch {
    // ignore per-file unlink errors
  }

  return removed;
}

export async function resolvePhotoThumbnailColumn(client) {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'photos'
       AND column_name = 'photo_thumbnail'
     LIMIT 1`
  );
  return result.rows[0]?.column_name || null;
}

/**
 * Generate thumbnail file and append photo_thumbnail to optional INSERT columns when column exists.
 */
export async function appendPhotoThumbnailToInsert(client, { optionalColumns, optionalValues, buffer, fileNameBase, outputDir }) {
  const thumbColumn = await resolvePhotoThumbnailColumn(client);
  if (!thumbColumn || !fileNameBase || !buffer?.length) {
    return { optionalColumns, optionalValues, photoThumbnail: null };
  }

  const photoThumbnail = await generateAndSavePhotoThumbnail({
    imageBuffer: buffer,
    photoFileNameBase: fileNameBase,
    outputDir
  });
  if (!photoThumbnail) {
    return { optionalColumns, optionalValues, photoThumbnail: null };
  }

  return {
    optionalColumns: [...optionalColumns, 'photo_thumbnail'],
    optionalValues: [...optionalValues, photoThumbnail],
    photoThumbnail
  };
}

/** Regenerate thumbnail after crop/save and UPDATE photos.photo_thumbnail. */
export async function regeneratePhotoThumbnail(db, photosId, buffer) {
  const id = Number(photosId);
  if (!Number.isFinite(id) || id < 1 || !buffer?.length) return null;

  const thumbColumn = await resolvePhotoThumbnailColumn(db);
  if (!thumbColumn) return null;

  const { rows } = await db.query(
    `SELECT photo_file_name, file_path, photo_thumbnail
     FROM helloworldjunktest.photos
     WHERE photos_id = $1
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  const fileNameBase = String(row.photo_file_name ?? id).trim();
  const outputDir = path.resolve(String(row.file_path || getPhotoFolder() || '').trim() || getPhotoFolder());
  if (!outputDir) return null;

  unlinkPhotoThumbnailFromDisk(row);

  const photoThumbnail = await generateAndSavePhotoThumbnail({
    imageBuffer: buffer,
    photoFileNameBase: fileNameBase,
    outputDir
  });
  if (!photoThumbnail) return null;

  await db.query(
    `UPDATE helloworldjunktest.photos SET photo_thumbnail = $1 WHERE photos_id = $2`,
    [photoThumbnail, id]
  );
  return photoThumbnail;
}
