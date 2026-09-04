import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  buildPhotoSearchFolders,
  getLegacyPhotoFolder,
  getPhotoFolder,
  resolvePhotoFilePathInFolders
} from './photoFilePath.js';
import { unlinkVideoThumbnailFromDisk } from './videoThumbnailPath.js';
import {
  ensureTutaDatesMemberLayout,
  listMemberTutaDatesVideoDirs,
  tutaDatesVideosPath,
  tutaDatesVideosPathLegacyLargeCheap
} from './tutaDatesMemberPaths.js';

const VIDEO_EXTS = ['webm', 'mp4', 'mp3', 'mov', 'avi', 'wmv'];

function expandFolderPath(folder) {
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  const trimmed = folder.trim().replace(/\/+$/, '');
  const expanded = trimmed.startsWith('~/') ? path.join(os.homedir(), trimmed.slice(2)) : trimmed;
  return expanded ? `${expanded}/` : '';
}

/** Legacy flat folder from TUTADATES_VIDEO_FOLDER or sibling of legacy photos. */
export function getLegacyVideoFolder() {
  const explicit = process.env.TUTADATES_VIDEO_FOLDER;
  if (explicit?.trim()) return expandFolderPath(explicit);

  const photoFolder = getLegacyPhotoFolder();
  if (!photoFolder) return '';
  const photoRoot = photoFolder.replace(/\/+$/, '');
  const parent = path.dirname(photoRoot);
  if (!parent || parent === photoRoot) return '';
  return `${parent}/videos/`;
}

/**
 * Video folder for one member under FAST_STORAGE_FOLDER/users/M{id}/tutadates/videos/.
 * Without memberId, returns legacy flat video folder.
 */
export function getVideoFolder(memberId = null) {
  const memberPart = memberId != null ? String(memberId).trim() : '';
  if (memberPart) {
    return `${tutaDatesVideosPath(memberPart).replace(/\/+$/, '')}/`;
  }
  return getLegacyVideoFolder();
}

export function getVideoFolderForMember(memberId) {
  const layout = ensureTutaDatesMemberLayout(memberId);
  return layout.videosFolder;
}

export function buildVideoSearchFolders({ filePathFromDb = null, memberId = null } = {}) {
  const folders = [];
  const seen = new Set();
  const add = (folder) => {
    const normalized = expandFolderPath(folder).replace(/\/+$/, '');
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    folders.push(`${normalized}/`);
  };

  add(filePathFromDb);
  if (memberId != null && String(memberId).trim()) {
    add(tutaDatesVideosPath(memberId));
    add(tutaDatesVideosPathLegacyLargeCheap(memberId));
  }
  add(getLegacyVideoFolder());
  for (const folder of buildPhotoSearchFolders({ memberId })) {
    add(folder);
  }
  return folders;
}

export function listTutaDatesVideoStorageRoots() {
  const roots = [];
  const seen = new Set();
  const add = (dir) => {
    const normalized = path.resolve(String(dir || '').replace(/\/+$/, ''));
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    roots.push(normalized);
  };

  const legacy = getLegacyVideoFolder().replace(/\/+$/, '');
  if (legacy) add(legacy);
  for (const dir of listMemberTutaDatesVideoDirs()) {
    add(dir);
  }
  return roots;
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
 * Resolve on-disk path for a videos row (member folder, DB file_path, legacy folders).
 * @returns {string|null}
 */
export function resolveVideoFilePath(videoFolder, videoFileName, videoId, ext, filePathFromDb = null, memberId = null) {
  const folders = [];
  const seen = new Set();

  if (memberId != null || filePathFromDb) {
    for (const folder of buildVideoSearchFolders({ filePathFromDb, memberId })) {
      addVideoSearchFolder(folders, seen, folder);
    }
  }

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
 * Remove on-disk files for one videos row.
 * @returns {{ removed: string[], videoFolder: string }}
 */
export function unlinkMemberVideoFilesFromDisk(row, { filePathFromDb = null, memberId = null } = {}) {
  const removed = new Set();
  const videoFileName = row?.videoFileName ?? row?.video_file_name ?? null;
  const fileExtension = row?.fileExtension ?? row?.file_extension ?? 'webm';
  const videoId = row?.videoId ?? row?.video_id;
  const dbPath = filePathFromDb ?? row?.filePath ?? row?.file_path ?? null;
  const ext = String(fileExtension || 'webm').replace(/^\./, '');
  const candidates = new Set();

  const resolved = resolveVideoFilePath(null, videoFileName, videoId, ext, dbPath, memberId);
  if (resolved) candidates.add(resolved);

  const fileBase = String(videoFileName || '').trim() || String(videoId);
  for (const folder of buildVideoSearchFolders({ filePathFromDb: dbPath, memberId })) {
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

  const folders = buildVideoSearchFolders({ filePathFromDb: dbPath, memberId });
  return { removed: [...removed], videoFolder: folders[0] || getVideoFolder() || getPhotoFolder() || '' };
}

export { resolvePhotoFilePathInFolders };
