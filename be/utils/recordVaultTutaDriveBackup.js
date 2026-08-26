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
import { vaultRootOnMount, VAULT_DIR_NAME, VAULT_META_FILE } from './recordVaultUsb/vaultPaths.js';

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

/** Delete every previous backup_* under the member folder (only one backup allowed). */
export function clearPreviousTutaDriveBackups(memberId, keepAbsPath = null) {
  const root = tutaDriveMemberRoot(memberId);
  if (!fs.existsSync(root)) return [];
  const keep = keepAbsPath ? path.resolve(keepAbsPath) : null;
  const removed = [];
  for (const name of fs.readdirSync(root)) {
    if (!BACKUP_NAME_RE.test(name)) continue;
    const abs = path.join(root, name);
    if (keep && path.resolve(abs) === keep) continue;
    fs.rmSync(abs, { force: true });
    removed.push(abs);
  }
  return removed;
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
  clearPreviousTutaDriveBackups(memberId);
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

/** Read the single current sealed backup (if any). */
export function readTutaDriveEncryptedBackup(memberId) {
  const list = listTutaDriveBackups(memberId);
  if (!list.length) return null;
  const current = list[0];
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
    removeDirRecursive(vaultRoot);
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
