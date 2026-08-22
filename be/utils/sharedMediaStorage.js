import fs from 'fs';
import path from 'path';
import os from 'os';
import { getPhotoFolder } from './photoFilePath.js';

function expandPath(raw) {
  const t = String(raw || '').trim().replace(/\/+$/, '');
  if (!t) return '';
  return t.startsWith('~/') ? path.join(os.homedir(), t.slice(2)) : t;
}

export function getVideoFolder() {
  const video = expandPath(process.env.VSINGLES_VIDEO_FOLDER);
  if (video) return `${video}/`;
  return getPhotoFolder();
}

export function isMultiServerClusterMode() {
  return String(process.env.CLUSTER_MULTI_SERVER || '').trim().toLowerCase() === 'true';
}

function isLikelyLocalOnlyPath(dirPath) {
  const normalized = path.resolve(String(dirPath || ''));
  const tmp = path.resolve(os.tmpdir());
  if (normalized.startsWith(tmp)) return true;
  const home = path.resolve(os.homedir());
  if (normalized.startsWith(path.join(home, 'onlinemallwebsite_storage'))) return true;
  return false;
}

/**
 * Checks the photo/video roots exist and are readable/writable by this process.
 * Runs on every startup: a folder owned by another user silently breaks every
 * upload at write time, which is otherwise only visible as a request failure.
 *
 * When CLUSTER_MULTI_SERVER=true, additionally requires shared storage (NFS, SAN,
 * object-mount) so all web hosts see the same files.
 */
export function validateMediaStorage() {
  const issues = [];
  const photoDir = getPhotoFolder().replace(/\/+$/, '');
  const videoDir = getVideoFolder().replace(/\/+$/, '');

  if (!photoDir) {
    issues.push('VSINGLES_PHOTO_FOLDER is not set');
  } else if (!fs.existsSync(photoDir)) {
    issues.push(`VSINGLES_PHOTO_FOLDER does not exist: ${photoDir}`);
  } else {
    try {
      fs.accessSync(photoDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      issues.push(`VSINGLES_PHOTO_FOLDER is not readable/writable: ${photoDir}`);
    }
    if (isMultiServerClusterMode() && isLikelyLocalOnlyPath(photoDir)) {
      issues.push(
        `VSINGLES_PHOTO_FOLDER looks local-only (${photoDir}) — use shared storage for CLUSTER_MULTI_SERVER`
      );
    }
  }

  if (videoDir && videoDir !== photoDir) {
    if (!fs.existsSync(videoDir)) {
      issues.push(`VSINGLES_VIDEO_FOLDER does not exist: ${videoDir}`);
    } else if (isMultiServerClusterMode() && isLikelyLocalOnlyPath(videoDir)) {
      issues.push(
        `VSINGLES_VIDEO_FOLDER looks local-only (${videoDir}) — use shared storage for CLUSTER_MULTI_SERVER`
      );
    }
  }

  return { ok: issues.length === 0, issues, photoDir, videoDir };
}
