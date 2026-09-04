import path from 'path';
import fs from 'fs';
import os from 'os';
import { photoThumbnailFileNameForBase, unlinkPhotoThumbnailFromDisk } from './photoThumbnail.js';
import {
  ensureTutaDatesMemberLayout,
  getTutaDatesStorageRoot,
  listMemberTutaDatesPhotoDirs,
  tutaDatesPhotosPath,
  tutaDatesPhotosPathLegacyLargeCheap,
  TUTADATES_VAULT_DIR
} from './tutaDatesMemberPaths.js';

/** System/verification photos — hidden from My Album by filename prefix. */
export function isSystemPhotoFileName(photoFileName) {
  const base = String(photoFileName || '').trim().toLowerCase();
  return (
    base.startsWith('consent_sig_') ||
    base.startsWith('consent_live_scan_video_') ||
    base.startsWith('consent_media_') ||
    base.startsWith('dl_face_ref_') ||
    base.startsWith('live_scan_ref_') ||
    base.startsWith('pp_face_ref_')
  );
}

function expandFolderPath(folder) {
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  const trimmed = folder.trim().replace(/\/+$/, '');
  const expanded = trimmed.startsWith('~/') ? path.join(os.homedir(), trimmed.slice(2)) : trimmed;
  return expanded ? `${expanded}/` : '';
}

/** Legacy flat folder from TUTADATES_PHOTO_FOLDER (pre per-member tutadates layout). */
export function getLegacyPhotoFolder() {
  const folder = process.env.TUTADATES_PHOTO_FOLDER;
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  return expandFolderPath(folder);
}

/**
 * Photo folder for one member under STORAGE_FOLDER/users/M{id}/tutadates/photos/.
 * Without memberId, returns legacy flat TUTADATES_PHOTO_FOLDER for admin / fallback reads.
 */
export function getPhotoFolder(memberId = null) {
  const memberPart = memberId != null ? String(memberId).trim() : '';
  if (memberPart) {
    return `${tutaDatesPhotosPath(memberPart).replace(/\/+$/, '')}/`;
  }
  return getLegacyPhotoFolder();
}

/** Ensure member layout exists, then return photos folder with trailing slash. */
export function getPhotoFolderForMember(memberId) {
  const layout = ensureTutaDatesMemberLayout(memberId);
  return layout.photosFolder;
}

/** Ordered folders to search when resolving a photo on disk (new path, DB path, legacy flat). */
export function buildPhotoSearchFolders({ filePathFromDb = null, memberId = null } = {}) {
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
    add(tutaDatesPhotosPath(memberId));
    add(tutaDatesPhotosPathLegacyLargeCheap(memberId));
  }
  add(getLegacyPhotoFolder());
  return folders;
}

/** All photo roots: legacy flat + every member tutadates/photos dir. */
export function listTutaDatesPhotoStorageRoots() {
  const roots = [];
  const seen = new Set();
  const add = (dir) => {
    const normalized = path.resolve(String(dir || '').replace(/\/+$/, ''));
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    roots.push(normalized);
  };

  const legacy = getLegacyPhotoFolder().replace(/\/+$/, '');
  if (legacy) add(legacy);
  for (const dir of listMemberTutaDatesPhotoDirs()) {
    add(dir);
  }
  return roots;
}

export function resolvePhotoFilePathInFolders(folders, photoFileName, photosId, ext) {
  for (const folder of folders || []) {
    const hit = resolvePhotoFilePath(folder, photoFileName, photosId, ext);
    if (hit) return hit;
  }
  return null;
}

export function resolvePhotoFilePathForListingInFolders(folders, photoFileName, ext) {
  for (const folder of folders || []) {
    const hit = resolvePhotoFilePathForListing(folder, photoFileName, ext);
    if (hit) return hit;
  }
  return null;
}

export function resolvePhotoOrigBackupPathInFolders(folders, photoFileName, photosId) {
  for (const folder of folders || []) {
    const hit = resolvePhotoOrigBackupPath(folder, photoFileName, photosId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Count regular files in TUTADATES_PHOTO_FOLDER (admin Tools → Tables row).
 * @returns {{ label: string, fileCount: number | null, missing: boolean }}
 */
export function countPhotoFolderFiles() {
  const envRaw = String(process.env.TUTADATES_PHOTO_FOLDER ?? '').trim();
  const roots = listTutaDatesPhotoStorageRoots();
  const cheapRoot = (() => {
    try {
      return getTutaDatesStorageRoot();
    } catch {
      return '';
    }
  })();
  const label =
    roots.length > 0
      ? roots.join(', ')
      : envRaw || cheapRoot
        ? `${cheapRoot}/users/M*/${TUTADATES_VAULT_DIR}/photos`
        : '(Tuta Dates photo storage not configured)';

  if (!roots.length) {
    return { label, fileCount: null, missing: true };
  }

  let fileCount = 0;
  let missing = false;
  for (const dir of roots) {
    if (!fs.existsSync(dir)) {
      missing = true;
      continue;
    }
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      fileCount += entries.filter((entry) => entry.isFile()).length;
    } catch {
      missing = true;
    }
  }
  return { label, fileCount, missing };
}

/**
 * Resolve on-disk path for a photos row.
 * Avoids matching a stale `{photosId}.{ext}` file when `photo_file_name` points at a different base name.
 * @returns {string|null} existing file path, or null if none found
 */
export function resolvePhotoFilePath(photoFolder, photoFileName, photosId, ext) {
  if (!photoFolder) return null;
  const normalizedExt = String(ext || 'jpg').replace(/^\./, '');
  const raw = String(photoFileName || '').trim();
  const candidates = [];

  if (raw) {
    candidates.push(path.join(photoFolder, raw));
    if (!raw.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) {
      candidates.push(path.join(photoFolder, `${raw}.${normalizedExt}`));
    }
    if (raw === String(photosId)) {
      candidates.push(path.join(photoFolder, `${photosId}.${normalizedExt}`));
    }
  } else {
    candidates.push(path.join(photoFolder, `${photosId}.${normalizedExt}`));
  }

  const hit = candidates.find((p) => fs.existsSync(p));
  return hit ? path.resolve(hit) : null;
}

export function normalizePhotoFileNameBase(raw, fallbackId) {
  const value = String(raw || '').trim();
  if (!value) return String(fallbackId);
  return value.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
}

/** `{photo_file_name}orig.jpg` or legacy `{photosId}orig.jpg` when present on disk. */
export function resolvePhotoOrigBackupPath(photoFolder, photoFileName, photosId) {
  if (!photoFolder) return null;
  const filePathDir = path.resolve(String(photoFolder).replace(/\/+$/, ''));
  const fileBase = normalizePhotoFileNameBase(photoFileName, photosId);
  const origPath = path.join(filePathDir, `${fileBase}orig.jpg`);
  const legacyOrigPath = path.join(filePathDir, `${photosId}orig.jpg`);
  if (fs.existsSync(origPath)) return path.resolve(origPath);
  if (fs.existsSync(legacyOrigPath)) return path.resolve(legacyOrigPath);
  return null;
}

/**
 * Listing-only resolver: requires `photo_file_name` and never falls back to `{photosId}.{ext}`.
 * Prevents stale on-disk files (e.g. legacy demo `4.jpg`) from appearing for unrelated rows.
 */
export function resolvePhotoFilePathForListing(photoFolder, photoFileName, ext) {
  if (!photoFolder) return null;
  const raw = String(photoFileName || '').trim();
  if (!raw) return null;
  const normalizedExt = String(ext || 'jpg').replace(/^\./, '');
  const candidates = [path.join(photoFolder, raw)];
  if (!raw.toLowerCase().endsWith(`.${normalizedExt.toLowerCase()}`)) {
    candidates.push(path.join(photoFolder, `${raw}.${normalizedExt}`));
  }
  const hit = candidates.find((p) => fs.existsSync(p));
  return hit ? path.resolve(hit) : null;
}

/**
 * True when a row belongs in the member's My Album (not legacy/orphan/demo collisions).
 */
export function isMemberAlbumPhotoRow({ photoFileName, memberId, profileImageFk, photosId }) {
  const name = String(photoFileName || '').trim();
  if (!name || isSystemPhotoFileName(name)) return false;
  const memberPart = memberId != null ? String(memberId).trim() : '';
  if (memberPart && name.startsWith(`${memberPart}_`)) return true;
  const profileFk = Number(profileImageFk);
  const pid = Number(photosId);
  return Number.isFinite(profileFk) && profileFk > 0 && profileFk === pid;
}

/** @deprecated use isSystemPhotoFileName */
export function isConsentSnapshotPhotoFileName(photoFileName) {
  return isSystemPhotoFileName(photoFileName);
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

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

function normalizePhotoRowArgs(row) {
  return {
    photoFileName: row?.photoFileName ?? row?.photo_file_name ?? null,
    fileExtension: row?.fileExtension ?? row?.file_extension ?? null,
    photosId: row?.photosId ?? row?.photos_id
  };
}

function addMemberPhotoFileCandidates(candidates, photoFolder, { photoFileName, fileExtension, photosId }) {
  const pid = Number(photosId);
  const fileBase = normalizePhotoFileNameBase(photoFileName, pid);
  const ext = String(fileExtension || 'jpg').replace(/^\./, '');

  const resolved = resolvePhotoFilePath(photoFolder, photoFileName, pid, ext);
  if (resolved) candidates.add(resolved);

  const rawName = String(photoFileName || '').trim();
  if (rawName) {
    candidates.add(path.join(photoFolder, rawName));
  }

  for (const tryExt of IMAGE_EXTS) {
    candidates.add(path.join(photoFolder, `${fileBase}.${tryExt}`));
  }

  // Only unlink bare `{photosId}.{ext}` for legacy rows named by photos_id.
  // Always deleting those when photo_file_name is already `memberId_…` can wipe
  // another member's legacy file that happens to be named `{thisRow.photos_id}.jpg`.
  const usesLegacyPhotosIdFileName =
    Number.isFinite(pid) &&
    pid > 0 &&
    (!rawName || fileBase === String(pid) || rawName === String(pid) || rawName === `${pid}.${ext}`);
  if (usesLegacyPhotosIdFileName) {
    for (const tryExt of IMAGE_EXTS) {
      candidates.add(path.join(photoFolder, `${pid}.${tryExt}`));
    }
    candidates.add(path.join(photoFolder, `${pid}orig.jpg`));
  }

  candidates.add(path.join(photoFolder, `${fileBase}orig.jpg`));

  const thumbName = photoThumbnailFileNameForBase(fileBase);
  if (thumbName) {
    candidates.add(path.join(photoFolder, thumbName));
  }
}

/**
 * List on-disk files in TUTADATES_PHOTO_FOLDER whose names start with `{memberId}_`.
 * @param {number | string | null | undefined} memberId
 * @returns {string[]}
 */
export function listPhotoFolderFilesForMemberId(memberId) {
  const memberPart = String(memberId ?? '').trim();
  if (!memberPart) return [];

  const prefix = `${memberPart}_`;
  const found = new Set();
  for (const folder of buildPhotoSearchFolders({ memberId: memberPart })) {
    const dir = folder.replace(/\/+$/, '');
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
        found.add(path.resolve(path.join(dir, entry.name)));
      }
    } catch {
      // try next folder
    }
  }
  return [...found];
}

/**
 * List existing on-disk files in TUTADATES_PHOTO_FOLDER for one photos row.
 * Accepts DB snake_case (`photo_file_name`) or camelCase keys.
 * @returns {string[]}
 */
export function listMemberPhotoFilesOnDisk(row, { filePathFromDb = null, memberId = null } = {}) {
  const folders = buildPhotoSearchFolders({
    filePathFromDb: filePathFromDb ?? row?.file_path ?? row?.filePath ?? null,
    memberId
  });
  if (!folders.length) return [];

  const { photoFileName, fileExtension, photosId } = normalizePhotoRowArgs(row);
  const candidates = new Set();
  for (const photoFolder of folders) {
    addMemberPhotoFileCandidates(candidates, photoFolder, { photoFileName, fileExtension, photosId });
  }

  const found = new Set();
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        found.add(path.resolve(candidate));
      }
    } catch {
      // ignore per-file stat errors
    }
  }

  return [...found];
}

/**
 * Remove on-disk member photo files from TUTADATES_PHOTO_FOLDER (main image, all ext variants, orig backups).
 * @returns {{ removed: string[], photoFolder: string }}
 */
export function unlinkMemberPhotoFilesFromDisk(row, { filePathFromDb = null, memberId = null } = {}) {
  const folders = buildPhotoSearchFolders({
    filePathFromDb: filePathFromDb ?? row?.file_path ?? row?.filePath ?? null,
    memberId
  });
  const removed = new Set();
  if (!folders.length) {
    return { removed: [], photoFolder: '' };
  }

  const { photoFileName, fileExtension, photosId } = normalizePhotoRowArgs(row);
  const candidates = new Set();
  for (const photoFolder of folders) {
    addMemberPhotoFileCandidates(candidates, photoFolder, { photoFileName, fileExtension, photosId });
  }
  for (const candidate of candidates) {
    tryUnlinkFile(candidate, removed);
  }

  for (const thumbPath of unlinkPhotoThumbnailFromDisk(row)) {
    removed.add(thumbPath);
  }

  return { removed: [...removed], photoFolder: folders[0] || '' };
}
