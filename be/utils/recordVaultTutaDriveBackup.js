/**
 * TutaDrive member backup — one encrypted backup file under users/M{id}/.
 * Plain vault zip is produced server-side; Encrypt Password sealing happens in the browser (DEK).
 *
 * Stored name: backup_YYYY-MM-DD.zip  (payload = TNBAK1 sealed bytes from client)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Extract } from 'unzipper';
import {
  ensureTutaDriveMemberLayout,
  loadMemberIdForSingles,
  tutaDriveMemberRoot
} from './tutaDriveMemberPaths.js';
import { getVaultSession, flushDbToUsb, logoffVaultUsb } from './recordVaultUsb/vaultSession.js';
import {
  vaultPhotosRoot,
  vaultRootOnMount,
  VAULT_DIR_NAME,
  VAULT_META_FILE
} from './recordVaultUsb/vaultPaths.js';

const BACKUP_NAME_RE = /^backup_\d{4}-\d{2}-\d{2}\.zip$/i;

function todayBackupStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function tutaDriveBackupFileName(dateStamp = todayBackupStamp()) {
  return `backup_${dateStamp}.zip`;
}

export function tutaDriveBackupAbsPath(memberId, dateStamp = todayBackupStamp()) {
  return path.join(tutaDriveMemberRoot(memberId), tutaDriveBackupFileName(dateStamp));
}

export const TUTADRIVE_BACKUP_MAX = 3;

/**
 * Delete backup_* files that exceed the max limit (oldest first).
 * Pass keepAbsPath to always preserve a just-written file even before it
 * appears in the sorted list.
 */
export function clearPreviousTutaDriveBackups(memberId, keepAbsPath = null, max = TUTADRIVE_BACKUP_MAX) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  const keep = keepAbsPath ? path.resolve(keepAbsPath) : null;
  const all = fs
    .readdirSync(root)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((name) => ({ name, abs: path.join(root, name), mtime: fs.statSync(path.join(root, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  // How many to keep: slots minus the one we just created (if keepAbsPath is the newest)
  const keepCount = Math.max(0, max - (keepAbsPath ? 1 : 0));
  const removed = [];
  let kept = 0;
  for (const entry of all) {
    if (keep && path.resolve(entry.abs) === keep) continue; // always keep the new file
    if (kept < keepCount) { kept += 1; continue; }
    fs.rmSync(entry.abs, { force: true });
    removed.push(entry.abs);
  }
  return removed;
}

/**
 * Delete a specific backup file by name (safe: only allows backup_*.zip names).
 * Returns true when deleted, false when not found.
 */
export function deleteTutaDriveBackupByName(memberId, fileName) {
  if (!BACKUP_NAME_RE.test(String(fileName || ''))) return false;
  const abs = path.join(tutaDriveMemberRoot(memberId), String(fileName));
  if (!fs.existsSync(abs)) return false;
  fs.rmSync(abs, { force: true });
  return true;
}

export function listTutaDriveBackups(memberId) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => BACKUP_NAME_RE.test(name))
    .map((name) => {
      const abs = path.join(root, name);
      const st = fs.statSync(abs);
      return { fileName: name, absPath: abs, sizeBytes: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function walkLocalFiles(dirPath, basePath = dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = [];
  for (const name of fs.readdirSync(dirPath)) {
    const abs = path.join(dirPath, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      entries.push(...walkLocalFiles(abs, basePath));
    } else {
      entries.push(path.relative(basePath, abs).split(path.sep).join('/'));
    }
  }
  return entries;
}

function copyEntryRecursive(srcPath, destPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const name of fs.readdirSync(srcPath)) {
      copyEntryRecursive(path.join(srcPath, name), path.join(destPath, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

function removeDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Drop the live TutaNotes vault so restore can copy into a clean tree.
 * Unlink photos/ first when it is a symlink (do not follow it and wipe sibling photos/).
 */
function wipeTutaDriveVaultForRestore(notesMount) {
  const vaultRoot = vaultRootOnMount(notesMount);
  const photosRoot = vaultPhotosRoot(notesMount);
  try {
    const st = fs.lstatSync(photosRoot);
    if (st.isSymbolicLink()) fs.unlinkSync(photosRoot);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  removeDirRecursive(vaultRoot);
}

function resolveVaultRootFromExtractedDir(extractDir) {
  const namedRoot = path.join(extractDir, VAULT_DIR_NAME);
  if (fs.existsSync(path.join(namedRoot, VAULT_META_FILE))) {
    return namedRoot;
  }
  if (fs.existsSync(path.join(extractDir, VAULT_META_FILE))) {
    return extractDir;
  }
  throw new Error(`Backup zip must contain a ${VAULT_DIR_NAME} folder with ${VAULT_META_FILE}`);
}

async function resolveMemberNotesMount(singlesId) {
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) throw new Error('Your member number is not set; cannot backup TutaDrive.');
  const layout = ensureTutaDriveMemberLayout(memberId, { singlesId });
  return { memberId, ...layout };
}

/**
 * Stream a plain zip of the member TutaNotes vault (for client Encrypt-Password sealing).
 */
export async function streamTutaDriveVaultBackupZip(singlesId, res) {
  const { memberId, notesMount } = await resolveMemberNotesMount(singlesId);
  const session = getVaultSession(singlesId, 'onedrive');
  if (session?.unlocked && session.mountPath) {
    const expected = path.resolve(notesMount);
    const actual = path.resolve(String(session.mountPath));
    if (actual === expected) {
      flushDbToUsb(session);
    }
  }

  const vaultRoot = vaultRootOnMount(notesMount);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Missing ${VAULT_DIR_NAME} folder on TutaDrive`);
  }

  const zipName = `TutaNotes_TutaDrive_${todayBackupStamp()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    archive.directory(vaultRoot, VAULT_DIR_NAME);
    void archive.finalize();
  });

  return { fileName: zipName, memberId, notesMount };
}

/**
 * Store the client-sealed backup (Encrypt Password / DEK). Replaces any prior backup_*.zip.
 */
export function storeTutaDriveEncryptedBackup(memberId, encryptedBytes) {
  const buf = Buffer.isBuffer(encryptedBytes) ? encryptedBytes : Buffer.from(encryptedBytes || []);
  if (!buf.length) throw new Error('Encrypted backup is empty');

  ensureTutaDriveMemberLayout(memberId);
  const dest = tutaDriveBackupAbsPath(memberId);
  clearPreviousTutaDriveBackups(memberId, dest);
  fs.writeFileSync(dest, buf);
  const st = fs.statSync(dest);
  return {
    fileName: path.basename(dest),
    absPath: dest,
    sizeBytes: st.size,
    memberFolder: path.basename(tutaDriveMemberRoot(memberId)),
    relativePath: path.join(path.basename(tutaDriveMemberRoot(memberId)), path.basename(dest))
  };
}

/** Read a sealed backup by file name, or the newest if fileName is omitted. */
export function readTutaDriveEncryptedBackup(memberId, fileName = null) {
  const list = listTutaDriveBackups(memberId);
  if (!list.length) return null;
  const wanted = String(fileName || '').trim();
  const current = wanted
    ? list.find((row) => String(row.fileName).toLowerCase() === wanted.toLowerCase())
    : list[0];
  if (!current) return null;
  const data = fs.readFileSync(current.absPath);
  return { ...current, data };
}

/**
 * Restore plain (already decrypted) zip into the member TutaNotes vault.
 * Closes cloud session first so files are not locked.
 */
export async function restoreTutaDriveVaultFromZipFile(singlesId, zipFilePath) {
  const { memberId, notesMount } = await resolveMemberNotesMount(singlesId);
  await logoffVaultUsb(singlesId, 'onedrive').catch(() => {});

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-tutadrive-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const sourceRoot = resolveVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(sourceRoot);
    if (!relFiles.length) {
      throw new Error('Backup zip is empty');
    }

    const vaultRoot = vaultRootOnMount(notesMount);
    wipeTutaDriveVaultForRestore(notesMount);
    fs.mkdirSync(vaultRoot, { recursive: true });
    for (const name of fs.readdirSync(sourceRoot)) {
      copyEntryRecursive(path.join(sourceRoot, name), path.join(vaultRoot, name));
    }

    let restoredBytes = 0;
    for (const rel of relFiles) {
      try {
        restoredBytes += fs.statSync(path.join(vaultRoot, rel)).size;
      } catch {
        // ignore
      }
    }

    ensureTutaDriveMemberLayout(memberId, { singlesId });

    return {
      restoredFiles: relFiles.length,
      restoredBytes,
      memberId,
      notesMount,
      requiresReunlock: true
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
