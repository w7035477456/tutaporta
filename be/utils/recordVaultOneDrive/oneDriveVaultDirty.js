/** Tracks OneDrive paths that changed locally and may need upload on logoff — cluster-wide via Redis. */

import {
  clusterRedisDel,
  clusterRedisRename,
  clusterRedisSAdd,
  clusterRedisSMembers,
  clusterRedisSRem
} from '../clusterRedisState.js';

const DIRTY_PREFIX = 'v1:record_vault:onedrive:dirty:';

function dirtyKey(singlesId) {
  return `${DIRTY_PREFIX}${Math.trunc(Number(singlesId))}`;
}

export function normalizeOneDriveRelativePath(relativePath) {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
}

export async function markOneDrivePathDirty(singlesId, relativePath) {
  const id = Number(singlesId);
  const rel = normalizeOneDriveRelativePath(relativePath);
  if (!Number.isFinite(id) || id < 1 || !rel) return;
  await clusterRedisSAdd(dirtyKey(id), rel);
}

export async function takeOneDriveDirtyPaths(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return [];
  const key = dirtyKey(id);
  // Rename-away so concurrent logoff on another node cannot double-take or miss paths.
  const takenKey = `${key}:taken:${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const renamed = await clusterRedisRename(key, takenKey);
  if (!renamed) return [];
  try {
    return await clusterRedisSMembers(takenKey);
  } finally {
    await clusterRedisDel(takenKey);
  }
}

export async function clearOneDrivePathDirty(singlesId, relativePath) {
  const id = Number(singlesId);
  const rel = normalizeOneDriveRelativePath(relativePath);
  if (!Number.isFinite(id) || id < 1 || !rel) return;
  await clusterRedisSRem(dirtyKey(id), rel);
}

export async function clearAllOneDriveDirty(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  await clusterRedisDel(dirtyKey(id));
}
