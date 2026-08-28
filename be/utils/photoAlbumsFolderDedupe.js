import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { appLog } from '../logger.js';
import { oneDriveStagingMountPath, resolveOneDriveStagingRoot } from './photoAlbumsOneDriveStagingRoot.js';
import {
  VAULT_DB_FILE_ENCRYPTED,
  VAULT_DB_FILE_PLAIN,
  VAULT_META_FILE,
  resolveVaultFileStoragePath,
  resolveVaultPhotoStoragePath,
  vaultFilesRoot,
  vaultPhotosRoot,
  vaultRootOnMount
} from './photoAlbumsUsb/vaultPaths.js';

const PROTECTED_BASENAMES = new Set([
  VAULT_META_FILE,
  VAULT_DB_FILE_PLAIN,
  VAULT_DB_FILE_ENCRYPTED,
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini'
]);

function sha256FileSync(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function isProtectedFileName(fileName) {
  const base = path.basename(String(fileName || ''));
  if (PROTECTED_BASENAMES.has(base)) return true;
  if (base.endsWith('.db') || base.endsWith('.db.enc')) return true;
  return false;
}

function isDirectory(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function collectFilesRecursive(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectFilesRecursive(full, out);
      continue;
    }
    if (!ent.isFile() || isProtectedFileName(ent.name)) continue;
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size < 1) continue;
    out.push({
      fullPath: full,
      sizeBytes: st.size,
      mtimeMs: st.mtimeMs
    });
  }
  return out;
}

function queryAllRows(db, sql, params = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch {
    return [];
  }
}

/**
 * Roots to scan for byte-identical duplicates:
 * - unlocked vault photos/ + files/ under session.mountPath
 * - OneDrive staging for this user (RECORD_PHOTOALBUMS_ONEDRIVE_STAGING_ROOT/{id})
 */
export function listPhotoAlbumsDedupeScanRoots({ session } = {}) {
  const roots = [];
  const seen = new Set();

  const addRoot = (raw) => {
    const resolved = path.resolve(String(raw || '').trim());
    if (!resolved || seen.has(resolved)) return;
    if (!isDirectory(resolved)) return;
    seen.add(resolved);
    roots.push(resolved);
  };

  const addVaultOrFolderRoots = (basePath) => {
    const base = String(basePath || '').trim();
    if (!base) return;
    const photos = vaultPhotosRoot(base);
    const files = vaultFilesRoot(base);
    const hasMedia = isDirectory(photos) || isDirectory(files);
    if (hasMedia) {
      addRoot(photos);
      addRoot(files);
      return;
    }
    // No vault layout yet — scan the folder itself (staging mount).
    addRoot(vaultRootOnMount(base));
    addRoot(base);
  };

  if (session?.mountPath) {
    addVaultOrFolderRoots(session.mountPath);
  }

  const singlesId = session?.driveSinglesId ?? session?.singlesId;
  if (singlesId != null && String(singlesId).trim() !== '') {
    addVaultOrFolderRoots(oneDriveStagingMountPath(singlesId));
    addRoot(path.join(resolveOneDriveStagingRoot(), String(singlesId)));
  }

  return roots;
}

function collectReferencedAbsPaths(session) {
  const referenced = new Set();
  if (!session?.db || !session?.mountPath) return referenced;

  const addRel = (relativePath, kind) => {
    const rel = String(relativePath || '').trim();
    if (!rel) return;
    try {
      const abs =
        kind === 'file'
          ? resolveVaultFileStoragePath(session.mountPath, rel)
          : resolveVaultPhotoStoragePath(session.mountPath, rel);
      if (abs) referenced.add(path.resolve(abs));
    } catch {
      // ignore
    }
  };

  for (const row of queryAllRows(
    session.db,
    `SELECT relative_path FROM note_attachments
     WHERE deleted_at IS NULL AND relative_path IS NOT NULL AND TRIM(relative_path) != ''`
  )) {
    addRel(row.relative_path, 'file');
  }

  for (const row of queryAllRows(
    session.db,
    `SELECT image_relative_path, image_top_relative_path, image_bottom_relative_path
     FROM notes WHERE deleted_at IS NULL`
  )) {
    addRel(row.image_relative_path, 'photo');
    addRel(row.image_top_relative_path, 'photo');
    addRel(row.image_bottom_relative_path, 'photo');
  }

  for (const row of queryAllRows(
    session.db,
    `SELECT relative_path FROM note_extra_images
     WHERE deleted_at IS NULL AND relative_path IS NOT NULL AND TRIM(relative_path) != ''`
  )) {
    addRel(row.relative_path, 'photo');
  }

  return referenced;
}

/**
 * Size-first, then SHA-256 checksum. Keep DB-referenced files; among orphans keep oldest.
 * Never deletes vault.meta.json / vault.db.
 *
 * Covers folders from:
 * - RECORD_PHOTOALBUMS_ONEDRIVE_STAGING_ROOT
 * - the unlocked session mount (USB / TutaDrive / staging)
 */
export function removeDuplicateFilesInPhotoAlbumsEnvFolders({ session } = {}) {
  const roots = listPhotoAlbumsDedupeScanRoots({ session });
  if (!roots.length) {
    return { scannedRoots: [], removed: [], kept: 0, groups: 0 };
  }

  const referenced = collectReferencedAbsPaths(session);
  const files = [];
  const seenFiles = new Set();
  for (const root of roots) {
    for (const file of collectFilesRecursive(root)) {
      const key = path.resolve(file.fullPath);
      if (seenFiles.has(key)) continue;
      if (isProtectedFileName(key)) continue;
      seenFiles.add(key);
      files.push({ ...file, fullPath: key });
    }
  }

  const bySize = new Map();
  for (const file of files) {
    if (!bySize.has(file.sizeBytes)) bySize.set(file.sizeBytes, []);
    bySize.get(file.sizeBytes).push(file);
  }

  const removed = [];
  let groups = 0;
  let kept = 0;

  for (const sizeGroup of bySize.values()) {
    if (sizeGroup.length < 2) continue;

    const byChecksum = new Map();
    for (const file of sizeGroup) {
      let checksum;
      try {
        checksum = sha256FileSync(file.fullPath);
      } catch {
        continue;
      }
      if (!byChecksum.has(checksum)) byChecksum.set(checksum, []);
      byChecksum.get(checksum).push({ ...file, checksum });
    }

    for (const checksumGroup of byChecksum.values()) {
      if (checksumGroup.length < 2) continue;
      groups += 1;

      const referencedInGroup = checksumGroup.filter((f) => referenced.has(f.fullPath));
      const orphans = checksumGroup.filter((f) => !referenced.has(f.fullPath));

      // Prefer keeping referenced paths; never delete a DB-referenced file.
      let keepSet = new Set(referencedInGroup.map((f) => f.fullPath));
      if (keepSet.size === 0) {
        const sorted = [...checksumGroup].sort(
          (a, b) => a.mtimeMs - b.mtimeMs || a.fullPath.localeCompare(b.fullPath)
        );
        keepSet = new Set([sorted[0].fullPath]);
      }

      kept += keepSet.size;

      for (const file of orphans) {
        if (keepSet.has(file.fullPath)) continue;
        try {
          fs.unlinkSync(file.fullPath);
          removed.push(file.fullPath);
        } catch (err) {
          appLog.warn(
            `[photoAlbumsFolderDedupe] failed to remove ${file.fullPath}: ${err?.message || err}`
          );
        }
      }
    }
  }

  if (removed.length) {
    appLog.info(
      `[photoAlbumsFolderDedupe] removed ${removed.length} duplicate file(s) across ${groups} group(s) under ${roots.length} root(s)`
    );
  }

  return { scannedRoots: roots, removed, kept, groups };
}
