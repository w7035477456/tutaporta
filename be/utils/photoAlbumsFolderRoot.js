import fs from 'fs';
import path from 'path';
import os from 'os';

function expandConfiguredRoot(raw) {
  const configured = String(raw || '').trim();
  if (!configured) return '';
  return configured.startsWith('~/') ? path.join(os.homedir(), configured.slice(2)) : configured;
}

/**
 * Local Photo Albums folder from RECORD_PHOTOALBUMS_FOLDER (expanded, resolved).
 * Empty string when unset.
 */
export function resolvePhotoAlbumsFolderRoot() {
  const configured = expandConfiguredRoot(process.env.RECORD_PHOTOALBUMS_FOLDER);
  if (!configured) return '';
  return path.resolve(configured);
}

/** True when the folder exists as a directory. */
export function isPhotoAlbumsFolderRootPresent() {
  const root = resolvePhotoAlbumsFolderRoot();
  if (!root) return false;
  try {
    return fs.existsSync(root) && fs.statSync(root).isDirectory();
  } catch {
    return false;
  }
}
