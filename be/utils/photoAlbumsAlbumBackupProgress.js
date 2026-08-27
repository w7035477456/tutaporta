/**
 * Cluster-safe album backup progress for FE polling during zip download.
 */

import { clusterRedisDel, clusterRedisGetJson, clusterRedisSetJson } from './clusterRedisState.js';

const KEY_PREFIX = 'v1:photo_albums:album_backup_progress:';
const TTL_SEC = 300;

function progressKey(singlesId) {
  return `${KEY_PREFIX}${Math.trunc(Number(singlesId))}`;
}

export async function setAlbumBackupProgress(
  singlesId,
  { percent = 0, label = '', fileIndex = 0, fileTotal = 0, bytesDone = 0 } = {}
) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  await clusterRedisSetJson(
    progressKey(id),
    {
      percent: clamped,
      label: label ? String(label) : '',
      fileIndex: Math.max(0, Math.round(Number(fileIndex) || 0)),
      fileTotal: Math.max(0, Math.round(Number(fileTotal) || 0)),
      bytesDone: Math.max(0, Math.round(Number(bytesDone) || 0)),
      updatedAt: Date.now()
    },
    TTL_SEC
  );
}

export async function getAlbumBackupProgress(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return { percent: 0, label: '', fileIndex: 0, fileTotal: 0, bytesDone: 0 };
  }
  const raw = await clusterRedisGetJson(progressKey(id));
  if (!raw || typeof raw !== 'object') {
    return { percent: 0, label: '', fileIndex: 0, fileTotal: 0, bytesDone: 0 };
  }
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(raw.percent) || 0))),
    label: raw.label ? String(raw.label) : '',
    fileIndex: Math.max(0, Math.round(Number(raw.fileIndex) || 0)),
    fileTotal: Math.max(0, Math.round(Number(raw.fileTotal) || 0)),
    bytesDone: Math.max(0, Math.round(Number(raw.bytesDone) || 0)),
    updatedAt: Number(raw.updatedAt) || 0
  };
}

export async function clearAlbumBackupProgress(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  await clusterRedisDel(progressKey(id));
}
