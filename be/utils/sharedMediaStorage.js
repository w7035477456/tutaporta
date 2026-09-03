import fs from 'fs';
import path from 'path';
import { getLargeCheapStorageFolderRoot } from './tutaDriveMemberPaths.js';
import {
  getLegacyPhotoFolder,
  listTutaDatesPhotoStorageRoots
} from './photoFilePath.js';
import {
  getLegacyVideoFolder,
  listTutaDatesVideoStorageRoots
} from './videoFilePath.js';
import { TUTADATES_VAULT_DIR } from './tutaDatesMemberPaths.js';

export { getVideoFolder } from './videoFilePath.js';

export function isMultiServerClusterMode() {
  return String(process.env.CLUSTER_MULTI_SERVER || '').trim().toLowerCase() === 'true';
}

function isLikelyLocalOnlyPath(dirPath) {
  const normalized = path.resolve(String(dirPath || ''));
  if (normalized.includes(`${path.sep}onlinemallwebsite_storage${path.sep}`)) return true;
  if (normalized.includes(`${path.sep}mac_storage${path.sep}onlinemallwebsite_storage`)) return true;
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
 * Validates legacy flat folders (if set) and LARGE_CHEAP_STORAGE/users (per-member tutadates layout).
 */
export function validateMediaStorage() {
  const issues = [];
  const photoRoots = listTutaDatesPhotoStorageRoots();
  const videoRoots = listTutaDatesVideoStorageRoots();

  if (!photoRoots.length && !getLegacyPhotoFolder()) {
    issues.push('Tuta Dates photo storage is not configured (LARGE_CHEAP_STORAGE_FOLDER or TUTADATES_PHOTO_FOLDER)');
  }

  for (const dir of photoRoots) {
    checkDirAccess('Tuta Dates photos root', dir, issues);
  }

  const legacyPhoto = getLegacyPhotoFolder().replace(/\/+$/, '');
  if (legacyPhoto && !photoRoots.includes(path.resolve(legacyPhoto))) {
    checkDirAccess('Legacy TUTADATES_PHOTO_FOLDER', legacyPhoto, issues);
  }

  for (const dir of videoRoots) {
    checkDirAccess('Tuta Dates videos root', dir, issues);
  }

  const legacyVideo = getLegacyVideoFolder().replace(/\/+$/, '');
  if (legacyVideo && !videoRoots.includes(path.resolve(legacyVideo))) {
    checkDirAccess('Legacy TUTADATES_VIDEO_FOLDER', legacyVideo, issues);
  }

  let cheapUsersDir = '';
  try {
    cheapUsersDir = path.join(getLargeCheapStorageFolderRoot(), 'users');
    if (!fs.existsSync(cheapUsersDir)) {
      issues.push(`LARGE_CHEAP_STORAGE_FOLDER users dir missing (${cheapUsersDir}) — expected M*/${TUTADATES_VAULT_DIR}/photos`);
    }
  } catch (err) {
    issues.push(err?.message || 'LARGE_CHEAP_STORAGE_FOLDER is not set');
  }

  return {
    ok: issues.length === 0,
    issues,
    photoDir: photoRoots[0] || legacyPhoto || '',
    videoDir: videoRoots[0] || legacyVideo || ''
  };
}
