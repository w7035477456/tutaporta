import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import {
  ensureVaultLayoutDirs,
  vaultPhotosRoot,
  vaultRootOnMount
} from './recordVaultUsb/vaultPaths.js';

/** LEFT_SIDE=OneDrive (default) | TutaDrive */
export function getLeftSideMode() {
  const raw = String(process.env.LEFT_SIDE ?? 'OneDrive').trim().toLowerCase();
  if (raw === 'tutadrive' || raw === 'tuta_drive' || raw === 'tuta-drive') return 'TutaDrive';
  return 'OneDrive';
}

export function isLeftSideTutaDrive() {
  return getLeftSideMode() === 'TutaDrive';
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
 * Ensure …/users/M{id}/notes and …/users/M{id}/photos exist.
 * Point vault photos dir at sibling photos/ via symlink when possible.
 */
export function ensureTutaDriveMemberLayout(memberId) {
  const notesMount = tutaDriveNotesMountPath(memberId);
  const photosAbs = tutaDrivePhotosPath(memberId);
  fs.mkdirSync(notesMount, { recursive: true });
  fs.mkdirSync(photosAbs, { recursive: true });
  ensureVaultLayoutDirs(notesMount);

  const vaultPhotos = vaultPhotosRoot(notesMount);
  try {
    if (fs.existsSync(vaultPhotos)) {
      const st = fs.lstatSync(vaultPhotos);
      if (st.isSymbolicLink()) {
        return { notesMount, photosAbs, vaultRoot: vaultRootOnMount(notesMount) };
      }
      // Replace empty photos dir with symlink to sibling photos/
      const entries = fs.readdirSync(vaultPhotos);
      if (entries.length === 0) {
        fs.rmdirSync(vaultPhotos);
      }
    }
    if (!fs.existsSync(vaultPhotos)) {
      fs.symlinkSync(photosAbs, vaultPhotos, 'dir');
    }
  } catch (err) {
    // Symlink may fail on some FS — vault keeps photos under notes/TutaNotes/photos.
    console.warn('[tutaDrive] photos symlink skipped:', err?.message || err);
    fs.mkdirSync(vaultPhotos, { recursive: true });
  }
  return { notesMount, photosAbs, vaultRoot: vaultRootOnMount(notesMount) };
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
