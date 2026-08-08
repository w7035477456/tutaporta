/**
 * Cluster-safe OneDrive mid-session sync progress (0–100) for FE polling.
 * Written by POST …/sync; read by GET …/sync-progress on any node.
 */

import { clusterRedisDel, clusterRedisGetJson, clusterRedisSetJson } from '../clusterRedisState.js';

const KEY_PREFIX = 'v1:photo_albums:onedrive:sync_progress:';
const TTL_SEC = 180;

function progressKey(singlesId) {
  return `${KEY_PREFIX}${Math.trunc(Number(singlesId))}`;
}

export async function setVaultSyncProgress(singlesId, { percent = 0, label = '' } = {}) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  await clusterRedisSetJson(
    progressKey(id),
    {
      percent: clamped,
      label: label ? String(label) : '',
      updatedAt: Date.now()
    },
    TTL_SEC
  );
}

export async function getVaultSyncProgress(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return { percent: 0, label: '' };
  const raw = await clusterRedisGetJson(progressKey(id));
  if (!raw || typeof raw !== 'object') return { percent: 0, label: '' };
  return {
    percent: Math.max(0, Math.min(100, Math.round(Number(raw.percent) || 0))),
    label: raw.label ? String(raw.label) : '',
    updatedAt: Number(raw.updatedAt) || 0
  };
}

export async function clearVaultSyncProgress(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  await clusterRedisDel(progressKey(id));
}
