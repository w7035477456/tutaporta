import fs from 'fs';
import path from 'path';
import { vaultRootOnMount } from './vaultPaths.js';

export function parseGbFromBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value / (1024 * 1024 * 1024)) * 10) / 10;
}

/** Recursive byte size of a directory tree (skips symlinks). */
export function computeDirectorySizeBytes(dirPath) {
  const root = String(dirPath ?? '').trim();
  if (!root) return 0;
  let total = 0;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {
        // skip unreadable entries
      }
    }
  }
  return total;
}

/** Bytes used by `.recordvault` on a mount; 0 when folder is missing. */
export function computeVaultFolderSizeBytes(mountPath) {
  const root = vaultRootOnMount(mountPath);
  try {
    if (!fs.statSync(root).isDirectory()) return 0;
  } catch {
    return 0;
  }
  return computeDirectorySizeBytes(root);
}

/** Vault folder size in GB (one decimal), always a number (0 when empty/missing). */
export function computeVaultFolderSizeGb(mountPath) {
  return parseGbFromBytes(computeVaultFolderSizeBytes(mountPath)) ?? 0;
}
