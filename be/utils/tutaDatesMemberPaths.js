import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  loadMemberIdForSingles,
  memberFolderName
} from './tutaDriveMemberPaths.js';

export const TUTADATES_VAULT_DIR = 'tutadates';

function expandRoot(folder) {
  const trimmed = String(folder || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return path.resolve(trimmed.startsWith('~/') ? path.join(os.homedir(), trimmed.slice(2)) : trimmed);
}

/** Primary Tuta Dates root: FAST_STORAGE_FOLDER (onlinemallwebsite_storage). */
export function getTutaDatesStorageRoot() {
  const storage = expandRoot(process.env.FAST_STORAGE_FOLDER);
  if (!storage) {
    throw new Error('FAST_STORAGE_FOLDER is not set in ~/.ssh/be/.env');
  }
  return storage;
}

/** Previous location before move to FAST_STORAGE_FOLDER — used for migration reads only. */
export function getLegacyLargeCheapStorageRoot() {
  return expandRoot(process.env.LARGE_CHEAP_STORAGE_FOLDER);
}

/** ${FAST_STORAGE_FOLDER}/users/M{id}/tutadates */
export function tutaDatesMemberRoot(memberId) {
  return path.join(getTutaDatesStorageRoot(), 'users', memberFolderName(memberId), TUTADATES_VAULT_DIR);
}

/** ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{id}/tutadates (pre-move source). */
export function tutaDatesMemberRootLegacyLargeCheap(memberId) {
  const root = getLegacyLargeCheapStorageRoot();
  if (!root) return '';
  return path.join(root, 'users', memberFolderName(memberId), TUTADATES_VAULT_DIR);
}

/** ${FAST_STORAGE_FOLDER}/users/M{id}/tutadates/photos */
export function tutaDatesPhotosPath(memberId) {
  return path.join(tutaDatesMemberRoot(memberId), 'photos');
}

/** ${FAST_STORAGE_FOLDER}/users/M{id}/tutadates/videos */
export function tutaDatesVideosPath(memberId) {
  return path.join(tutaDatesMemberRoot(memberId), 'videos');
}

export function tutaDatesPhotosPathLegacyLargeCheap(memberId) {
  const root = tutaDatesMemberRootLegacyLargeCheap(memberId);
  return root ? path.join(root, 'photos') : '';
}

export function tutaDatesVideosPathLegacyLargeCheap(memberId) {
  const root = tutaDatesMemberRootLegacyLargeCheap(memberId);
  return root ? path.join(root, 'videos') : '';
}

/**
 * Ensure per-member Tuta Dates photos + videos dirs exist under FAST_STORAGE_FOLDER.
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

function listMemberTutaDatesSubdirs(storageRoot, subdir) {
  const out = [];
  if (!storageRoot) return out;
  const usersDir = path.join(storageRoot, 'users');
  if (!fs.existsSync(usersDir)) return out;

  for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || !/^M\d+$/i.test(ent.name)) continue;
    const target = path.join(usersDir, ent.name, TUTADATES_VAULT_DIR, subdir);
    if (fs.existsSync(target)) {
      out.push(path.resolve(target));
    }
  }
  return out;
}

/** List FAST_STORAGE_FOLDER/users/M{id}/tutadates/photos directories. */
export function listMemberTutaDatesPhotoDirs() {
  return listMemberTutaDatesSubdirs(getTutaDatesStorageRoot(), 'photos');
}

/** List FAST_STORAGE_FOLDER/users/M{id}/tutadates/videos directories. */
export function listMemberTutaDatesVideoDirs() {
  return listMemberTutaDatesSubdirs(getTutaDatesStorageRoot(), 'videos');
}

/** List LARGE_CHEAP_STORAGE/users/M{id}/tutadates/photos (migration source). */
export function listLegacyLargeCheapTutaDatesPhotoDirs() {
  return listMemberTutaDatesSubdirs(getLegacyLargeCheapStorageRoot(), 'photos');
}

/** List LARGE_CHEAP_STORAGE/users/M{id}/tutadates/videos (migration source). */
export function listLegacyLargeCheapTutaDatesVideoDirs() {
  return listMemberTutaDatesSubdirs(getLegacyLargeCheapStorageRoot(), 'videos');
}

/** Every M###### folder name under FAST_STORAGE_FOLDER/users and LARGE_CHEAP/users. */
export function listAllMemberFolderNamesOnDisk() {
  const seen = new Set();
  for (const root of [getTutaDatesStorageRoot(), getLegacyLargeCheapStorageRoot()].filter(Boolean)) {
    const usersDir = path.join(root, 'users');
    if (!fs.existsSync(usersDir)) continue;
    for (const ent of fs.readdirSync(usersDir, { withFileTypes: true })) {
      if (ent.isDirectory() && /^M\d+$/i.test(ent.name)) {
        seen.add(ent.name.toUpperCase());
      }
    }
  }
  return [...seen].sort();
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
