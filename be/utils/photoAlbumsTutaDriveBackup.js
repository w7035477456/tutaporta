/**
 * TutaPhotos TutaCloud backup — plain vault zip for client Encrypt-Password sealing (TNBAK2/3).
 * Same architecture as recordVaultTutaDriveBackup.js (TutaNotes).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Extract } from 'unzipper';
import {
  ensureTutaDrivePhotoAlbumsLayout,
  loadMemberIdForSingles
} from './tutaDriveMemberPaths.js';
import { getVaultSession, logoffVaultUsb } from './photoAlbumsUsb/vaultSession.js';
import {
  vaultRootOnMount,
  VAULT_DIR_NAME,
  VAULT_META_FILE
} from './photoAlbumsUsb/vaultPaths.js';
import { computeDirectorySizeBytes } from './photoAlbumsUsb/vaultFolderSize.js';
import { readVaultMeta } from './photoAlbumsUsb/usbScan.js';
import { openVaultBuffer, sealVaultBuffer } from './photoAlbumsUsb/vaultCrypto.js';
import { vaultMetaUsesPlaintextStorage } from './photoAlbumsIconEncryption.js';
import {
  exportPhotoAlbumsMemberVaultIndex,
  importPhotoAlbumsMemberVaultIndex,
  isPhotoAlbumsVaultIndex
} from './photoAlbumsUsb/vaultPgStore.js';
import { listEnvVaultUnlockKeys } from './vaultKeys.js';
import {
  buildVaultIndexBackupEntry,
  findVaultIndexBackupFile,
  isVaultIndexBackupFileName,
  listVaultIndexBackupKeys,
  readVaultIndexBackupFile,
  TUTAPHOTOALBUMS_INDEX_BACKUP_FILE
} from './vaultIndexBackup.js';

function todayBackupStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}_${hh}-${mi}-${ss}`;
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

async function resolveLivePhotoAlbumsVaultKey(albumsMount) {
  const meta = readVaultMeta(albumsMount);
  if (!meta || vaultMetaUsesPlaintextStorage(meta)) return null;
  return (await listEnvVaultUnlockKeys('tutaCloud', meta))[0]?.key ?? null;
}

async function resolveMemberAlbumsMount(singlesId) {
  const memberId = await loadMemberIdForSingles(singlesId);
  if (!memberId) throw new Error('Your member number is not set; cannot backup TutaPhotos.');
  const layout = ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });
  return { memberId, ...layout };
}

export async function readTutaPhotoAlbumsBackupIndex(extractDir, sourceRoot) {
  const indexPath = findVaultIndexBackupFile(
    [extractDir, path.dirname(sourceRoot), sourceRoot],
    TUTAPHOTOALBUMS_INDEX_BACKUP_FILE
  );
  if (!indexPath) {
    throw new Error(
      'This backup has no album index (it only holds media files), so it cannot be restored. Nothing was changed.'
    );
  }
  const backupMeta = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(sourceRoot, VAULT_META_FILE), 'utf8'));
    } catch {
      return null;
    }
  })();
  const keys = await listVaultIndexBackupKeys(backupMeta);
  const { index, key } = readVaultIndexBackupFile(
    indexPath,
    keys,
    openVaultBuffer,
    isPhotoAlbumsVaultIndex
  );
  return { index, key, backupMeta, indexPath };
}

/**
 * Stream a plain zip of the member TutaPhotos vault (for client Encrypt-Password sealing).
 */
export async function streamPhotoAlbumsTutaDriveBackupZip(singlesId, res) {
  const { memberId, albumsMount } = await resolveMemberAlbumsMount(singlesId);
  const session = getVaultSession(singlesId, 'tutaCloud');
  if (session?.mountPath) {
    const expected = path.resolve(albumsMount);
    const actual = path.resolve(String(session.mountPath));
    if (actual !== expected) {
      // Unrelated session — still zip the member folder on disk.
    }
  }

  const vaultRoot = vaultRootOnMount(albumsMount);
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Missing ${VAULT_DIR_NAME} folder on TutaCloud`);
  }

  const indexEntry = buildVaultIndexBackupEntry(
    await exportPhotoAlbumsMemberVaultIndex(singlesId),
    await resolveLivePhotoAlbumsVaultKey(albumsMount),
    TUTAPHOTOALBUMS_INDEX_BACKUP_FILE,
    sealVaultBuffer
  );

  const zipName = `TutaPhotos_TutaCloud_${todayBackupStamp()}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Last-Modified', new Date().toUTCString());
  const estimatedBytes = computeDirectorySizeBytes(vaultRoot) + indexEntry.buffer.length;
  res.setHeader('X-Estimated-Content-Length', String(estimatedBytes));
  res.flushHeaders?.();

  const archive = new ZipArchive({ zlib: { level: 6 } });
  await new Promise((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    archive.directory(vaultRoot, VAULT_DIR_NAME);
    archive.append(indexEntry.buffer, { name: indexEntry.name });
    void archive.finalize();
  });

  return { fileName: zipName, memberId, albumsMount };
}

/**
 * Restore plain (already decrypted) zip into the member TutaPhotos vault.
 * Closes cloud session first so files are not locked. Does not require an unlocked session.
 */
export async function restorePhotoAlbumsTutaDriveVaultFromZipFile(singlesId, zipFilePath) {
  const { memberId, albumsMount } = await resolveMemberAlbumsMount(singlesId);
  await logoffVaultUsb(singlesId, 'tutaCloud').catch(() => {});

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-tutadrive-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const sourceRoot = resolveVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(sourceRoot).filter(
      (rel) => !isVaultIndexBackupFileName(rel, TUTAPHOTOALBUMS_INDEX_BACKUP_FILE)
    );
    if (!relFiles.length) {
      throw new Error('Backup zip is empty');
    }
    const { index, backupMeta, indexPath } = await readTutaPhotoAlbumsBackupIndex(extractDir, sourceRoot);

    const vaultRoot = vaultRootOnMount(albumsMount);
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

    ensureTutaDrivePhotoAlbumsLayout(memberId, { singlesId });

    return {
      restoredFiles: relFiles.length,
      restoredBytes,
      memberId,
      albumsMount,
      indexCounts,
      requiresReunlock: true
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
