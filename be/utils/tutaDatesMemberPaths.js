import fs from 'fs';
import path from 'path';

import {
  getLargeCheapStorageFolderRoot,
  loadMemberIdForSingles,
  memberFolderName
} from './tutaDriveMemberPaths.js';

export const TUTADATES_VAULT_DIR = 'tutadates';

/** ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/tutadates */
export function tutaDatesMemberRoot(memberId) {
  return path.join(getLargeCheapStorageFolderRoot(), 'users', memberFolderName(memberId), TUTADATES_VAULT_DIR);
}

/** ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/tutadates/photos */
export function tutaDatesPhotosPath(memberId) {
  return path.join(tutaDatesMemberRoot(memberId), 'photos');
}

/** ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/tutadates/videos */
export function tutaDatesVideosPath(memberId) {
  return path.join(tutaDatesMemberRoot(memberId), 'videos');
}

/**
 * Ensure per-member Tuta Dates photos + videos dirs exist.
 * @returns {{ photosPath: string, videosPath: string, photosFolder: string, videosFolder: string }}
 */
export function ensureTutaDatesMemberLayout(memberId) {
  const photosPath = tutaDatesPhotosPath(memberId);
  const videosPath = tutaDatesVideosPath(memberId);
  fs.mkdirSync(photosPath, { recursive: true });
  fs.mkdirSync(videosPath, { recursive: true });
  return {
    photosPath,
    videosPath,
    photosFolder: `${photosPath.replace(/\/+$/, '')}/`,
    videosFolder: `${videosPath.replace(/\/+$/, '')}/`
  };
}

/** List on-disk users/M{id}/tutadates/photos directories (new layout). */
export function listMemberTutaDatesPhotoDirs() {
  const out = [];
  const usersDir = path.join(getLargeCheapStorageFolderRoot(), 'users');
  if (!fs.existsSync(usersDir)) return out;

  for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const photosDir = path.join(usersDir, ent.name, TUTADATES_VAULT_DIR, 'photos');
    if (fs.existsSync(photosDir)) {
      out.push(path.resolve(photosDir));
    }
  }
  return out;
}

/** List on-disk users/M{id}/tutadates/videos directories (new layout). */
export function listMemberTutaDatesVideoDirs() {
  const out = [];
  const usersDir = path.join(getLargeCheapStorageFolderRoot(), 'users');
  if (!fs.existsSync(usersDir)) return out;

  for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const videosDir = path.join(usersDir, ent.name, TUTADATES_VAULT_DIR, 'videos');
    if (fs.existsSync(videosDir)) {
      out.push(path.resolve(videosDir));
    }
  }
  return out;
}

export async function loadMemberIdForSinglesOrFallback(singlesId) {
  const memberId = await loadMemberIdForSingles(singlesId);
  if (memberId) return memberId;
  const sid = Number(singlesId);
  return Number.isFinite(sid) && sid > 0 ? String(Math.trunc(sid)) : null;
}

export async function resolveTutaDatesPhotoFolderForSingles(singlesId) {
  const memberId = await loadMemberIdForSinglesOrFallback(singlesId);
  if (!memberId) {
    throw new Error('Member number not set for this account');
  }
  return ensureTutaDatesMemberLayout(memberId).photosFolder;
}

export async function resolveTutaDatesVideoFolderForSingles(singlesId) {
  const memberId = await loadMemberIdForSinglesOrFallback(singlesId);
  if (!memberId) {
    throw new Error('Member number not set for this account');
  }
  return ensureTutaDatesMemberLayout(memberId).videosFolder;
}

export { loadMemberIdForSingles, memberFolderName };
