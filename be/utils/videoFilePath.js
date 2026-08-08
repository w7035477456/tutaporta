import path from 'path';
import fs from 'fs';
import os from 'os';
import { getPhotoFolder } from './photoFilePath.js';
import { unlinkVideoThumbnailFromDisk } from './videoThumbnailPath.js';

const VIDEO_EXTS = ['webm', 'mp4', 'mp3', 'mov', 'avi', 'wmv'];

function expandFolderPath(folder) {
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  const trimmed = folder.trim().replace(/\/+$/, '');
  const expanded = trimmed.startsWith('~/') ? path.join(os.homedir(), trimmed.slice(2)) : trimmed;
  return expanded ? `${expanded}/` : '';
}

/** VSINGLES_VIDEO_FOLDER from env; default sibling `{parent of photos}/videos/`. */
export function getVideoFolder() {
  const explicit = process.env.VSINGLES_VIDEO_FOLDER;
  if (explicit?.trim()) return expandFolderPath(explicit);

  const photoFolder = getPhotoFolder();
  if (!photoFolder) return '';
  const photoRoot = photoFolder.replace(/\/+$/, '');
  const parent = path.dirname(photoRoot);
  if (!parent || parent === photoRoot) return '';
  return `${parent}/videos/`;
}

function addVideoSearchFolder(folders, seen, folder) {
  const normalized = expandFolderPath(folder);
  if (normalized && !seen.has(normalized)) {
    seen.add(normalized);
    folders.push(normalized);
  }
}
function buildVideoFileCandidates(folder, videoFileName, videoId, ext) {
  if (!folder) return [];
  const normalizedExt = String(ext || 'webm').replace(/^\./, '');
  const raw = String(videoFileName || '').trim();
  const candidates = [];

  if (raw) {
    candidates.push(path.join(folder, raw));
    if (!raw.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) {
      candidates.push(path.join(folder, `${raw}.${normalizedExt}`));
    }
    if (raw === String(videoId)) {
      candidates.push(path.join(folder, `${videoId}.${normalizedExt}`));
    }
  } else if (Number.isFinite(Number(videoId)) && Number(videoId) > 0) {
    candidates.push(path.join(folder, `${videoId}.${normalizedExt}`));
  }

  return candidates;
}

/**
 * Resolve on-disk path for a videos row (VSINGLES_VIDEO_FOLDER, DB file_path, legacy photos folder).
 * @returns {string|null}
 */
export function resolveVideoFilePath(videoFolder, videoFileName, videoId, ext, filePathFromDb = null) {
  const folders = [];
  const seen = new Set();

  addVideoSearchFolder(folders, seen, getVideoFolder());
  addVideoSearchFolder(folders, seen, filePathFromDb);
  addVideoSearchFolder(folders, seen, videoFolder);
  addVideoSearchFolder(folders, seen, getPhotoFolder());

  if (!folders.length) return null;

  const normalizedExt = String(ext || 'webm').replace(/^\./, '');
  const extsToTry = [...new Set([normalizedExt, ...VIDEO_EXTS])];

  for (const folder of folders) {
    for (const tryExt of extsToTry) {
      const hit = buildVideoFileCandidates(folder, videoFileName, videoId, tryExt).find((p) => fs.existsSync(p));
      if (hit) return path.resolve(hit);
    }
  }

  return null;
}

function tryUnlinkFile(targetPath, removed) {
  if (!targetPath || removed.has(targetPath)) return;
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      removed.add(targetPath);
    }
  } catch {
    // ignore per-file unlink errors
  }
}

/**
 * Remove on-disk files for one videos row from VSINGLES_PHOTO_FOLDER.
 * @returns {{ removed: string[], videoFolder: string }}
 */
export function unlinkMemberVideoFilesFromDisk(row) {
  const removed = new Set();
  const videoFileName = row?.videoFileName ?? row?.video_file_name ?? null;
  const fileExtension = row?.fileExtension ?? row?.file_extension ?? 'webm';
  const videoId = row?.videoId ?? row?.video_id;
  const filePathFromDb = row?.filePath ?? row?.file_path ?? null;
  const ext = String(fileExtension || 'webm').replace(/^\./, '');
  const candidates = new Set();

  const resolved = resolveVideoFilePath(null, videoFileName, videoId, ext, filePathFromDb);
  if (resolved) candidates.add(resolved);

  const fileBase = String(videoFileName || '').trim() || String(videoId);
  for (const folder of [getVideoFolder(), getPhotoFolder()].filter(Boolean)) {
    for (const tryExt of VIDEO_EXTS) {
      candidates.add(path.join(folder.replace(/\/+$/, ''), `${fileBase}.${tryExt}`));
    }
  }

  for (const candidate of candidates) {
    tryUnlinkFile(candidate, removed);
  }

  for (const thumbPath of unlinkVideoThumbnailFromDisk(row)) {
    removed.add(thumbPath);
  }

  return { removed: [...removed], videoFolder: getVideoFolder() || getPhotoFolder() || '' };
}
