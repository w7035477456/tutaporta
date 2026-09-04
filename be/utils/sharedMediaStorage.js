import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLegacyPhotoFolder, listTutaDatesPhotoStorageRoots } from './photoFilePath.js';
import {
  getLegacyVideoFolder,
  listTutaDatesVideoStorageRoots
} from './videoFilePath.js';
import { getTutaDatesStorageRoot, TUTADATES_VAULT_DIR } from './tutaDatesMemberPaths.js';

export { getVideoFolder } from './videoFilePath.js';

export function isMultiServerClusterMode() {
  return String(process.env.CLUSTER_MULTI_SERVER || '').trim().toLowerCase() === 'true';
}

/** True for ephemeral/home-local paths that cannot be shared across cluster web hosts. */
function isLikelyLocalOnlyPath(dirPath) {
  const normalized = path.resolve(String(dirPath || ''));
  const tmp = path.resolve(os.tmpdir());
  if (normalized.startsWith(tmp + path.sep) || normalized === tmp) return true;
  // Shared mounts like /mnt/pgdata16/... are fine; only reject bare home-local storage.
  const homeStorage = path.join(os.homedir(), 'onlinemallwebsite_storage');
  if (normalized === homeStorage || normalized.startsWith(homeStorage + path.sep)) return true;
  return false;
}

function checkDirAccess(label, dirPath, issues) {
  const dir = String(dirPath || '').replace(/\/+$/, '');
  if (!dir) return;
  if (!fs.existsSync(dir)) {
    issues.push(`${label} does not exist: ${dir}`);
    return;
  }
  try {
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    issues.push(`${label} is not readable/writable: ${dir}`);
  }
  if (isMultiServerClusterMode() && isLikelyLocalOnlyPath(dir)) {
    issues.push(`${label} looks local-only (${dir}) — use shared storage for CLUSTER_MULTI_SERVER`);
  }
}

/**
 * Validates STORAGE_FOLDER/users/M{id}/tutadates and legacy flat folders when set.
 */
export function validateMediaStorage() {
  const issues = [];
  const photoRoots = listTutaDatesPhotoStorageRoots();
  const videoRoots = listTutaDatesVideoStorageRoots();

  if (!photoRoots.length && !getLegacyPhotoFolder()) {
    issues.push('Tuta Dates photo storage is not configured (STORAGE_FOLDER or TUTADATES_PHOTO_FOLDER)');
  }

  for (const dir of photoRoots) {
    checkDirAccess('Tuta Dates photos root', dir, issues);
  }

  const legacyPhoto = getLegacyPhotoFolder().replace(/\/+$/, '');
  if (legacyPhoto && !photoRoots.includes(path.resolve(legacyPhoto))) {
    checkDirAccess('Legacy flat TUTADATES_PHOTO_FOLDER', legacyPhoto, issues);
  }

  for (const dir of videoRoots) {
    checkDirAccess('Tuta Dates videos root', dir, issues);
  }

  const legacyVideo = getLegacyVideoFolder().replace(/\/+$/, '');
  if (legacyVideo && !videoRoots.includes(path.resolve(legacyVideo))) {
    checkDirAccess('Legacy flat TUTADATES_VIDEO_FOLDER', legacyVideo, issues);
  }

  let storageUsersDir = '';
  try {
    storageUsersDir = path.join(getTutaDatesStorageRoot(), 'users');
    if (!fs.existsSync(storageUsersDir)) {
      issues.push(`STORAGE_FOLDER users dir missing (${storageUsersDir}) — expected M*/${TUTADATES_VAULT_DIR}/photos`);
    }
  } catch (err) {
    issues.push(err?.message || 'STORAGE_FOLDER is not set');
  }

  return {
    ok: issues.length === 0,
    issues,
    photoDir: photoRoots[0] || legacyPhoto || '',
    videoDir: videoRoots[0] || legacyVideo || ''
  };
}
