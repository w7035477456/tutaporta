import path from 'path';
import fs from 'fs';
import { getPhotoFolder } from './photoFilePath.js';
import { getVideoFolder } from './videoFilePath.js';

function expandFolderPath(folder) {
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  return folder.trim().replace(/\/+$/, '');
}

/**
 * Resolve on-disk path for videos.video_thumbnail (JPEG in file_path folder).
 * @returns {string|null}
 */
export function resolveVideoThumbnailPath(videoThumbnail, filePathFromDb = null) {
  const fileName = String(videoThumbnail ?? '').trim();
  if (!fileName) return null;

  const folders = [];
  const seen = new Set();
  for (const folder of [getVideoFolder(), filePathFromDb, getPhotoFolder()].filter(Boolean)) {
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

/**
 * Remove thumbnail JPEG for one videos row.
 * @returns {string[]} removed absolute paths
 */
export function unlinkVideoThumbnailFromDisk(row) {
  const removed = [];
  const thumbName = row?.videoThumbnail ?? row?.video_thumbnail ?? null;
  const resolved = resolveVideoThumbnailPath(thumbName, row?.filePath ?? row?.file_path ?? null);
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
