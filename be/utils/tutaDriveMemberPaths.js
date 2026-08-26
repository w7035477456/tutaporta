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
import { oneDriveStagingMountPath } from './recordVaultOneDriveStagingRoot.js';
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
 * Link …/notes/TutaNotes/photos → …/users/M{id}/photos when possible.
 * If vault photos is a real dir with files, merge into sibling photos/ first.
 */
function linkVaultPhotosToMemberPhotos(notesMount, photosAbs) {
  const vaultPhotos = vaultPhotosRoot(notesMount);
  try {
    if (fs.existsSync(vaultPhotos)) {
      const st = fs.lstatSync(vaultPhotos);
      if (st.isSymbolicLink()) {
        return;
      }
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
      fs.symlinkSync(photosAbs, vaultPhotos, 'dir');
    }
  } catch (err) {
    // Symlink may fail on some FS — keep photos under notes/TutaNotes/photos.
    console.warn('[tutaDrive] photos symlink skipped:', err?.message || err);
    fs.mkdirSync(vaultPhotos, { recursive: true });
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
  ensureVaultLayoutDirs(notesMount); // notes/TutaNotes/{files,photos}
  fs.mkdirSync(vaultFilesRoot(notesMount), { recursive: true });
  ensurePathWritableOrThrow(notesMount, { route: 'ensureTutaDriveMemberLayout:notes' });
  ensurePathWritableOrThrow(photosAbs, { route: 'ensureTutaDriveMemberLayout:photos' });

  if (Number.isFinite(singlesId) && singlesId >= 1) {
    try {
      migrateLegacyOneDriveStagingToTutaDrive(singlesId, memberId);
      // Re-ensure dirs after copy (staging may omit empty folders).
      ensureVaultLayoutDirs(notesMount);
    } catch (err) {
      console.warn('[tutaDrive] staging migrate skipped:', err?.message || err);
    }
  }

  linkVaultPhotosToMemberPhotos(notesMount, photosAbs);

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
