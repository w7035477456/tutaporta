import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Extract } from 'unzipper';
import { getVaultSession, logoffVaultUsb } from './vaultSession.js';
import { vaultRootOnMount, VAULT_DIR_NAME, VAULT_META_FILE } from './vaultPaths.js';
import { openVaultBuffer, sealVaultBuffer } from './vaultCrypto.js';
import { exportPhotoAlbumsMemberVaultIndex, importPhotoAlbumsMemberVaultIndex, isPhotoAlbumsVaultIndex } from './vaultPgStore.js';
import {
  buildVaultIndexBackupEntry,
  findVaultIndexBackupFile,
  isVaultIndexBackupFileName,
  listVaultIndexBackupKeys,
  readVaultIndexBackupFile,
  TUTAPHOTOALBUMS_INDEX_BACKUP_FILE
} from '../vaultIndexBackup.js';
import { buildMyPhotoAlbumsBackupZipFileName } from '../photoAlbumsBackupZipNames.js';

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

function resolveUsbVaultRootFromExtractedDir(extractDir) {
  const namedRoot = path.join(extractDir, VAULT_DIR_NAME);
  if (fs.existsSync(path.join(namedRoot, VAULT_META_FILE))) {
    return namedRoot;
  }
  if (fs.existsSync(path.join(extractDir, VAULT_META_FILE))) {
    return extractDir;
  }
  throw new Error(`Backup zip must contain a ${VAULT_DIR_NAME} folder with ${VAULT_META_FILE}`);
}

/** Stream a zip of the unlocked USB `.recordvault` folder to the HTTP response. */
export async function streamUsbVaultBackupZip(singlesId, res) {
  const session = getVaultSession(singlesId, 'usb');
  if (!session?.mountPath) {
    throw new Error('Record Vault USB not unlocked');
  }

  const vaultRoot = vaultRootOnMount(session.mountPath);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Missing ${VAULT_DIR_NAME} folder on USB`);
  }

  const indexEntry = buildVaultIndexBackupEntry(
    await exportPhotoAlbumsMemberVaultIndex(singlesId),
    session.key,
    TUTAPHOTOALBUMS_INDEX_BACKUP_FILE,
    sealVaultBuffer
  );

  const zipName = buildMyPhotoAlbumsBackupZipFileName('usb');
  const archiveRootName = VAULT_DIR_NAME;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  // Streamed zip has no stored mtime — date it now so macOS shows a Date Added.
  res.setHeader('Last-Modified', new Date().toUTCString());

  const archive = new ZipArchive({ zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    archive.directory(vaultRoot, archiveRootName);
    archive.append(indexEntry.buffer, { name: indexEntry.name });
    void archive.finalize();
  });

  return { fileName: zipName, mountPath: session.mountPath };
}

/**
 * Restore USB `.recordvault` from a local zip (closes session first so files are not locked).
 * Caller must re-unlock the vault afterward.
 */
async function restoreVaultFromZipFileForStorage(singlesId, zipFilePath, storageType) {
  const session = getVaultSession(singlesId, storageType);
  if (!session?.mountPath) {
    throw new Error(
      storageType === 'usb' ? 'Record Vault USB not unlocked' : 'TutaPhotoAlbums TutaCloud vault not unlocked'
    );
  }
  const mountPath = session.mountPath;
  const label = path.basename(mountPath);

  await logoffVaultUsb(singlesId, storageType);

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-usb-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const sourceRoot = resolveUsbVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(sourceRoot).filter((rel) => !isVaultIndexBackupFileName(rel, TUTAPHOTOALBUMS_INDEX_BACKUP_FILE));
    if (!relFiles.length) {
      throw new Error('Backup zip is empty');
    }
    const indexPath = findVaultIndexBackupFile([extractDir, path.dirname(sourceRoot), sourceRoot], TUTAPHOTOALBUMS_INDEX_BACKUP_FILE);
    if (!indexPath) {
      throw new Error(
        'This backup has no album index (it only holds media files), so it cannot be restored. Nothing was changed.'
      );
    }
    let backupMeta = null;
    try {
      backupMeta = JSON.parse(fs.readFileSync(path.join(sourceRoot, VAULT_META_FILE), 'utf8'));
    } catch {
      backupMeta = null;
    }
    const { index } = readVaultIndexBackupFile(
      indexPath,
      await listVaultIndexBackupKeys(backupMeta),
      openVaultBuffer,
      isPhotoAlbumsVaultIndex
    );

    const vaultRoot = vaultRootOnMount(mountPath);
    removeDirRecursive(vaultRoot);
    fs.mkdirSync(vaultRoot, { recursive: true });
    for (const name of fs.readdirSync(sourceRoot)) {
      if (isVaultIndexBackupFileName(name, TUTAPHOTOALBUMS_INDEX_BACKUP_FILE)) continue;
      copyEntryRecursive(path.join(sourceRoot, name), path.join(vaultRoot, name));
    }
    const indexCounts = await importPhotoAlbumsMemberVaultIndex(singlesId, index, {
      vaultId: backupMeta?.vaultId ?? null,
      source: 'restore',
      importedFromPath: path.basename(indexPath)
    });

    let restoredBytes = 0;
    for (const rel of relFiles) {
      try {
        restoredBytes += fs.statSync(path.join(vaultRoot, rel)).size;
      } catch {
        // ignore
      }
    }

    return {
      restoredFiles: relFiles.length,
      restoredBytes,
      mountPath,
      label,
      indexCounts,
      requiresReunlock: true
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

/** Restore USB `.recordvault` from a local zip (closes session first). */
export async function restoreUsbVaultFromZipFile(singlesId, zipFilePath) {
  return restoreVaultFromZipFileForStorage(singlesId, zipFilePath, 'usb');
}

/** Restore TutaCloud album vault from zip (internal session slot `tutaCloud`). */
export async function restoreTutaCloudVaultFromZipFile(singlesId, zipFilePath) {
  return restoreVaultFromZipFileForStorage(singlesId, zipFilePath, 'tutaCloud');
}
