import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import {
  ensureVaultLayoutDirs,
  vaultFilesRoot,
  vaultHasDbFile,
  vaultPhotosRoot,
  vaultRootOnMount
} from './recordVaultUsb/vaultPaths.js';
import { computeDirectorySizeBytes, parseGbFromBytes } from './recordVaultUsb/vaultFolderSize.js';
import { oneDriveStagingMountPath } from './recordVaultOneDriveStagingRoot.js';
import { oneDriveStagingMountPath as photoAlbumsOneDriveStagingMountPath } from './photoAlbumsOneDriveStagingRoot.js';
import {
  ensureVaultLayoutDirs as ensurePhotoAlbumsVaultLayoutDirs,
  vaultHasDbFile as photoAlbumsVaultHasDbFile,
  vaultRootOnMount as photoAlbumsVaultRootOnMount
} from './photoAlbumsUsb/vaultPaths.js';
import { ensurePathWritableOrThrow } from './appStorageFolderPerms.js';

/** LEFT_SIDE=OneDrive (default) | TutaDrive | None */
export function getLeftSideMode() {
  const raw = String(process.env.LEFT_SIDE ?? 'OneDrive').trim().toLowerCase();
  if (raw === 'none' || raw === 'off' || raw === '0' || raw === 'false' || raw === 'hide') {
    return 'None';
  }
  if (raw === 'tutadrive' || raw === 'tuta_drive' || raw === 'tuta-drive') return 'TutaDrive';
  return 'OneDrive';
}

export function isLeftSideTutaDrive() {
  return getLeftSideMode() === 'TutaDrive';
}

export function isLeftSideOffered() {
  return getLeftSideMode() !== 'None';
}

/**
 * RIGHT_SIDE=USB | None — /myNote right panel.
 * When unset, callers fall back to NOTES_LOCAL_USB (see recordVaultStorageFlags).
 */
export function getRightSideMode() {
  const raw = String(process.env.RIGHT_SIDE ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'none' || raw === 'off' || raw === '0' || raw === 'false' || raw === 'hide') {
    return 'None';
  }
  if (raw === 'usb') return 'USB';
  return 'USB';
}

export function isRightSideUsb() {
  const mode = getRightSideMode();
  if (mode == null) return null;
  return mode === 'USB';
}

/**
 * TutaDrive bulk data root — intended for large/cheap mechanical RAID later.
 * Prefer LARGE_CHEAP_STORAGE_FOLDER; fall back to STORAGE_FOLDER when unset.
 */
export function getLargeCheapStorageFolderRoot() {
  const cheap = String(process.env.LARGE_CHEAP_STORAGE_FOLDER || '').trim();
  const storage = String(process.env.STORAGE_FOLDER || '').trim();
  const root = cheap || storage;
  if (!root) {
    throw new Error(
      'LARGE_CHEAP_STORAGE_FOLDER (or STORAGE_FOLDER) is not set in ~/.ssh/be/.env'
    );
  }
  return path.resolve(root);
}

/** @deprecated Use getLargeCheapStorageFolderRoot — kept for any older imports. */
export function getStorageFolderRoot() {
  return getLargeCheapStorageFolderRoot();
}

/** Folder name M{member_id} e.g. M1136631 */
export function memberFolderName(memberId) {
  const id = String(memberId ?? '').trim();
  if (!id) throw new Error('member_id is required');
  return id.startsWith('M') || id.startsWith('m') ? `M${id.slice(1)}` : `M${id}`;
}

export async function loadMemberIdForSingles(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const { rows } = await pool.query(
    `SELECT member_id
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  const memberId = rows[0]?.member_id;
  if (memberId == null || String(memberId).trim() === '') return null;
  return String(memberId).trim();
}

export function tutaDriveMemberRoot(memberId) {
  return path.join(getLargeCheapStorageFolderRoot(), 'users', memberFolderName(memberId));
}

/** Vault mount = ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/notes */
export function tutaDriveNotesMountPath(memberId) {
  return path.join(tutaDriveMemberRoot(memberId), 'notes');
}

export function tutaDrivePhotosPath(memberId) {
  return path.join(tutaDriveMemberRoot(memberId), 'photos');
}

/**
 * On-disk usage for TutaDrive Total GB: only
 *   ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/notes
 *   ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/photos
 * Symlinks are skipped (so notes→photos link is not double-counted).
 * Does not include photoalbums/, backup_*.zip, or other siblings.
 */
export function computeTutaDriveMemberNotesPhotosSize(memberId) {
  const notesPath = tutaDriveNotesMountPath(memberId);
  const photosPath = tutaDrivePhotosPath(memberId);
  const notesBytes = computeDirectorySizeBytes(notesPath);
  const photosBytes = computeDirectorySizeBytes(photosPath);
  const totalBytes = notesBytes + photosBytes;
  const totalMb = totalBytes > 0 ? totalBytes / (1024 * 1024) : 0;
  return {
    notesPath,
    photosPath,
    notesBytes,
    photosBytes,
    totalBytes,
    totalMb,
    usedGb: parseGbFromBytes(totalBytes) ?? 0
  };
}

/**
 * Resolve current member and return notes+photos size, or null if unavailable.
 */
export async function loadTutaDriveMemberNotesPhotosSizeForSingles(singlesId) {
  if (!isLeftSideTutaDrive()) return null;
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) return null;
  return {
    memberId,
    memberFolder: memberFolderName(memberId),
    ...computeTutaDriveMemberNotesPhotosSize(memberId)
  };
}

/**
 * Link …/notes/TutaNotes/photos → …/users/M{id}/photos when possible.
 * If vault photos is a real dir with files, merge into sibling photos/ first.
 * Repairs broken or stale symlinks (e.g. after LARGE_CHEAP_STORAGE_FOLDER moved).
 */
function linkVaultPhotosToMemberPhotos(notesMount, photosAbs) {
  const vaultPhotos = vaultPhotosRoot(notesMount);
  const expectedAbs = path.resolve(photosAbs);

  try {
    let st = null;
    try {
      st = fs.lstatSync(vaultPhotos);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }

    if (st?.isSymbolicLink()) {
      const rawTarget = fs.readlinkSync(vaultPhotos);
      const resolvedTarget = path.resolve(path.dirname(vaultPhotos), rawTarget);
      const targetOk = fs.existsSync(vaultPhotos) && resolvedTarget === expectedAbs;
      if (targetOk) return;
      // Broken or points at an old STORAGE path — drop and recreate.
      fs.unlinkSync(vaultPhotos);
      st = null;
    }

    if (st && !st.isSymbolicLink()) {
      const entries = fs.readdirSync(vaultPhotos);
      if (entries.length === 0) {
        fs.rmdirSync(vaultPhotos);
      } else {
        fs.mkdirSync(photosAbs, { recursive: true });
        fs.cpSync(vaultPhotos, photosAbs, { recursive: true, force: true });
        fs.rmSync(vaultPhotos, { recursive: true, force: true });
      }
    }

    if (!fs.existsSync(vaultPhotos)) {
      fs.mkdirSync(photosAbs, { recursive: true });
      fs.symlinkSync(photosAbs, vaultPhotos, 'dir');
    }
  } catch (err) {
    // Symlink may fail on some FS — keep photos under notes/TutaNotes/photos.
    console.warn('[tutaDrive] photos symlink skipped:', err?.message || err);
    try {
      const st = fs.lstatSync(vaultPhotos);
      if (st.isSymbolicLink()) fs.unlinkSync(vaultPhotos);
    } catch {
      // ignore
    }
    try {
      const st = fs.lstatSync(vaultPhotos);
      if (st.isDirectory() || st.isSymbolicLink()) return;
      fs.rmSync(vaultPhotos, { force: true });
    } catch (existsErr) {
      if (existsErr?.code !== 'ENOENT') throw existsErr;
    }
    fs.mkdirSync(vaultPhotos, { recursive: true });
  }
}

/** Drop a broken vault photos symlink so mkdir/layout can recreate it. */
function clearBrokenVaultPhotosSymlink(notesMount) {
  const vaultPhotos = vaultPhotosRoot(notesMount);
  try {
    const st = fs.lstatSync(vaultPhotos);
    if (!st.isSymbolicLink()) return;
    if (fs.existsSync(vaultPhotos)) return;
    fs.unlinkSync(vaultPhotos);
    console.warn(`[tutaDrive] removed broken photos symlink at ${vaultPhotos}`);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('[tutaDrive] clearBrokenVaultPhotosSymlink:', err?.message || err);
    }
  }
}

/**
 * One-time: if TutaDrive vault is empty but OneDrive staging has a vault for this
 * singles_id, copy it into …/users/M{memberId}/notes/TutaNotes.
 */
export function migrateLegacyOneDriveStagingToTutaDrive(singlesId, memberId) {
  const notesMount = tutaDriveNotesMountPath(memberId);
  if (vaultHasDbFile(notesMount)) return { migrated: false, reason: 'dest_has_vault' };

  const stagingMount = oneDriveStagingMountPath(singlesId);
  const stagingVault = vaultRootOnMount(stagingMount);
  if (!vaultHasDbFile(stagingMount) && !fs.existsSync(path.join(stagingVault, 'vault.meta.json'))) {
    return { migrated: false, reason: 'no_staging_vault' };
  }
  if (!fs.existsSync(stagingVault)) {
    return { migrated: false, reason: 'no_staging_vault' };
  }

  const destVault = vaultRootOnMount(notesMount);
  fs.mkdirSync(destVault, { recursive: true });
  fs.cpSync(stagingVault, destVault, { recursive: true, force: true });
  console.info(
    `[tutaDrive] migrated OneDrive staging vault singles_id=${singlesId} → ${destVault}`
  );
  return { migrated: true, from: stagingVault, to: destVault };
}

/**
 * Ensure per-member TutaDrive tree for the current user:
 *   ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/
 *     notes/TutaNotes/{files,photos,vault.db,…}
 *     photos/   (sibling; vault photos/ usually symlinks here)
 *
 * Called on every TutaDrive status/unlock/init for that singles session.
 * When singlesId is passed, also migrates leftover OneDrive staging vault once.
 */
export function ensureTutaDriveMemberLayout(memberId, options = {}) {
  const singlesId = options?.singlesId != null ? Number(options.singlesId) : null;
  const notesMount = tutaDriveNotesMountPath(memberId);
  const photosAbs = tutaDrivePhotosPath(memberId);
  const memberRoot = tutaDriveMemberRoot(memberId);

  // Create M{id} and all subfolders (same as the manual mkdir/rsync/ln script).
  ensurePathWritableOrThrow(memberRoot, {
    route: 'ensureTutaDriveMemberLayout',
    singlesId: Number.isFinite(singlesId) ? singlesId : undefined
  });
  fs.mkdirSync(notesMount, { recursive: true });
  fs.mkdirSync(photosAbs, { recursive: true });
  // Repair before ensureVaultLayoutDirs — mkdir on a broken photos→old-path symlink throws ENOENT.
  clearBrokenVaultPhotosSymlink(notesMount);
  linkVaultPhotosToMemberPhotos(notesMount, photosAbs);
  ensureVaultLayoutDirs(notesMount); // notes/TutaNotes/{files,photos}
  fs.mkdirSync(vaultFilesRoot(notesMount), { recursive: true });
  ensurePathWritableOrThrow(notesMount, { route: 'ensureTutaDriveMemberLayout:notes' });
  ensurePathWritableOrThrow(photosAbs, { route: 'ensureTutaDriveMemberLayout:photos' });

  if (Number.isFinite(singlesId) && singlesId >= 1) {
    try {
      migrateLegacyOneDriveStagingToTutaDrive(singlesId, memberId);
      // Re-ensure dirs after copy (staging may omit empty folders).
      clearBrokenVaultPhotosSymlink(notesMount);
      ensureVaultLayoutDirs(notesMount);
      linkVaultPhotosToMemberPhotos(notesMount, photosAbs);
    } catch (err) {
      console.warn('[tutaDrive] staging migrate skipped:', err?.message || err);
    }
  }

  return {
    notesMount,
    photosAbs,
    vaultRoot: vaultRootOnMount(notesMount),
    memberRoot,
    memberFolder: memberFolderName(memberId)
  };
}

export function wipeTutaDriveMemberVault(memberId) {
  const notesMount = tutaDriveNotesMountPath(memberId);
  const vaultRoot = vaultRootOnMount(notesMount);
  if (fs.existsSync(vaultRoot)) {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  }
  // Recreate empty layout (notes + photos dirs stay)
  ensureTutaDriveMemberLayout(memberId);
}

/** Vault mount = ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/photoalbums */
export function tutaDrivePhotoAlbumsMountPath(memberId) {
  return path.join(tutaDriveMemberRoot(memberId), 'photoalbums');
}

/**
 * One-time: copy leftover Photo Albums OneDrive staging → TutaDrive photoalbums vault.
 */
export function migrateLegacyPhotoAlbumsStagingToTutaDrive(singlesId, memberId) {
  const albumsMount = tutaDrivePhotoAlbumsMountPath(memberId);
  if (photoAlbumsVaultHasDbFile(albumsMount)) {
    return { migrated: false, reason: 'dest_has_vault' };
  }

  const stagingMount = photoAlbumsOneDriveStagingMountPath(singlesId);
  const stagingVault = photoAlbumsVaultRootOnMount(stagingMount);
  if (
    !photoAlbumsVaultHasDbFile(stagingMount) &&
    !fs.existsSync(path.join(stagingVault, 'vault.meta.json'))
  ) {
    return { migrated: false, reason: 'no_staging_vault' };
  }
  if (!fs.existsSync(stagingVault)) {
    return { migrated: false, reason: 'no_staging_vault' };
  }

  const destVault = photoAlbumsVaultRootOnMount(albumsMount);
  fs.mkdirSync(destVault, { recursive: true });
  fs.cpSync(stagingVault, destVault, { recursive: true, force: true });
  console.info(
    `[tutaDrive/photoAlbums] migrated OneDrive staging singles_id=${singlesId} → ${destVault}`
  );
  return { migrated: true, from: stagingVault, to: destVault };
}

/**
 * Ensure per-member Photo Albums TutaDrive tree:
 *   ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/photoalbums/TutaPhotoAlbums/…
 */
export function ensureTutaDrivePhotoAlbumsLayout(memberId, options = {}) {
  const singlesId = options?.singlesId != null ? Number(options.singlesId) : null;
  const albumsMount = tutaDrivePhotoAlbumsMountPath(memberId);
  const memberRoot = tutaDriveMemberRoot(memberId);

  ensurePathWritableOrThrow(memberRoot, {
    route: 'ensureTutaDrivePhotoAlbumsLayout',
    singlesId: Number.isFinite(singlesId) ? singlesId : undefined
  });
  fs.mkdirSync(albumsMount, { recursive: true });
  ensurePhotoAlbumsVaultLayoutDirs(albumsMount);
  ensurePathWritableOrThrow(albumsMount, { route: 'ensureTutaDrivePhotoAlbumsLayout:mount' });

  if (Number.isFinite(singlesId) && singlesId >= 1) {
    try {
      migrateLegacyPhotoAlbumsStagingToTutaDrive(singlesId, memberId);
      ensurePhotoAlbumsVaultLayoutDirs(albumsMount);
    } catch (err) {
      console.warn('[tutaDrive/photoAlbums] staging migrate skipped:', err?.message || err);
    }
  }

  return {
    albumsMount,
    vaultRoot: photoAlbumsVaultRootOnMount(albumsMount),
    memberRoot,
    memberFolder: memberFolderName(memberId)
  };
}

export function wipeTutaDrivePhotoAlbumsVault(memberId) {
  const albumsMount = tutaDrivePhotoAlbumsMountPath(memberId);
  const vaultRoot = photoAlbumsVaultRootOnMount(albumsMount);
  if (fs.existsSync(vaultRoot)) {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  }
  ensureTutaDrivePhotoAlbumsLayout(memberId);
}
