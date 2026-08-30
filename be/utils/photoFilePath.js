import path from 'path';
import fs from 'fs';
import os from 'os';
import { photoThumbnailFileNameForBase, unlinkPhotoThumbnailFromDisk } from './photoThumbnail.js';

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

/** Folder from VSINGLES_PHOTO_FOLDER only. Expands ~. Ignores DB file_path. */
export function getPhotoFolder() {
  const folder = process.env.VSINGLES_PHOTO_FOLDER;
  if (!folder || typeof folder !== 'string' || !folder.trim()) return '';
  const t = folder.trim().replace(/\/+$/, '');
  const expanded = t.startsWith('~/') ? path.join(os.homedir(), t.slice(2)) : t;
  return expanded ? `${expanded}/` : '';
}

/**
 * Count regular files in VSINGLES_PHOTO_FOLDER (admin Tools → Tables row).
 * @returns {{ label: string, fileCount: number | null, missing: boolean }}
 */
export function countPhotoFolderFiles() {
  const envRaw = String(process.env.VSINGLES_PHOTO_FOLDER ?? '').trim();
  const folder = getPhotoFolder();
  const label = folder ? folder.replace(/\/+$/, '') : envRaw || '(VSINGLES_PHOTO_FOLDER not set)';

  if (!folder) {
    return { label, fileCount: null, missing: true };
  }

  const dir = folder.replace(/\/+$/, '');
  if (!fs.existsSync(dir)) {
    return { label: dir, fileCount: 0, missing: true };
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const fileCount = entries.filter((entry) => entry.isFile()).length;
    return { label: dir, fileCount, missing: false };
  } catch {
    return { label: dir, fileCount: null, missing: true };
  }
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
 * List on-disk files in VSINGLES_PHOTO_FOLDER whose names start with `{memberId}_`.
 * @param {number | string | null | undefined} memberId
 * @returns {string[]}
 */
export function listPhotoFolderFilesForMemberId(memberId) {
  const photoFolder = getPhotoFolder();
  if (!photoFolder) return [];

  const memberPart = String(memberId ?? '').trim();
  if (!memberPart) return [];

  const prefix = `${memberPart}_`;
  const dir = photoFolder.replace(/\/+$/, '');
  const found = new Set();

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
      found.add(path.resolve(path.join(dir, entry.name)));
    }
  } catch {
    return [];
  }

  return [...found];
}

/**
 * List existing on-disk files in VSINGLES_PHOTO_FOLDER for one photos row.
 * Accepts DB snake_case (`photo_file_name`) or camelCase keys.
 * @returns {string[]}
 */
export function listMemberPhotoFilesOnDisk(row) {
  const photoFolder = getPhotoFolder();
  if (!photoFolder) return [];

  const { photoFileName, fileExtension, photosId } = normalizePhotoRowArgs(row);
  const candidates = new Set();
  addMemberPhotoFileCandidates(candidates, photoFolder, { photoFileName, fileExtension, photosId });

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
 * Remove on-disk member photo files from VSINGLES_PHOTO_FOLDER (main image, all ext variants, orig backups).
 * @returns {{ removed: string[], photoFolder: string }}
 */
export function unlinkMemberPhotoFilesFromDisk(row) {
  const photoFolder = getPhotoFolder();
  const removed = new Set();
  if (!photoFolder) {
    return { removed: [], photoFolder: '' };
  }

  const { photoFileName, fileExtension, photosId } = normalizePhotoRowArgs(row);
  const candidates = new Set();
  addMemberPhotoFileCandidates(candidates, photoFolder, { photoFileName, fileExtension, photosId });
  for (const candidate of candidates) {
    tryUnlinkFile(candidate, removed);
  }

  for (const thumbPath of unlinkPhotoThumbnailFromDisk(row)) {
    removed.add(thumbPath);
  }

  return { removed: [...removed], photoFolder };
}
