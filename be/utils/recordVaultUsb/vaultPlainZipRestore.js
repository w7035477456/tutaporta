import fs from 'fs';
import os from 'os';
import path from 'path';
import { Extract } from 'unzipper';
import {
  vaultPhotosRoot,
  vaultRootOnMount,
  VAULT_DIR_NAME,
  VAULT_META_FILE
} from './vaultPaths.js';
import { deleteNotesMemberVault, importNotesMemberVaultIndex, isNotesVaultIndex } from './vaultPgStore.js';
import { openVaultBuffer } from './vaultCrypto.js';
import {
  findVaultIndexBackupFile,
  isVaultIndexBackupFileName,
  listVaultIndexBackupKeys,
  readVaultIndexBackupFile,
  TUTANOTES_INDEX_BACKUP_FILE
} from '../vaultIndexBackup.js';

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

export function resolveVaultRootFromExtractedDir(extractDir) {
  const namedRoot = path.join(extractDir, VAULT_DIR_NAME);
  if (fs.existsSync(path.join(namedRoot, VAULT_META_FILE))) {
    return namedRoot;
  }
  if (fs.existsSync(path.join(extractDir, VAULT_META_FILE))) {
    return extractDir;
  }
  throw new Error(`Backup zip must contain a ${VAULT_DIR_NAME} folder with ${VAULT_META_FILE}`);
}

/**
 * Drop the live TutaNotes vault so restore can copy into a clean tree.
 * Unlink photos/ first when it is a symlink (do not follow it and wipe sibling photos/).
 * When `singlesId` is set, also clear the member's Postgres notes index.
 */
export async function wipeVaultForPlainZipRestore(mountPath, { singlesId = null } = {}) {
  const vaultRoot = vaultRootOnMount(mountPath);
  const photosRoot = vaultPhotosRoot(mountPath);
  try {
    const st = fs.lstatSync(photosRoot);
    if (st.isSymbolicLink()) fs.unlinkSync(photosRoot);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  removeDirRecursive(vaultRoot);
  if (singlesId != null) {
    await deleteNotesMemberVault(singlesId);
  }
}

/**
 * Extract a plain vault zip into mountPath (parent of TutaNotes/). With `singlesId`, the zip's
 * notes index (Postgres export at the zip root) replaces the member's index.
 * @returns {{ restoredFiles: number, restoredBytes: number }}
 */
export async function restorePlainVaultZipToMount(mountPath, zipFilePath, { singlesId = null } = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-vault-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const sourceRoot = resolveVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(sourceRoot).filter(
      (rel) => !isVaultIndexBackupFileName(rel, TUTANOTES_INDEX_BACKUP_FILE)
    );
    if (!relFiles.length) {
      throw new Error('Vault zip is empty');
    }
    let backupMeta = null;
    try {
      backupMeta = JSON.parse(fs.readFileSync(path.join(sourceRoot, VAULT_META_FILE), 'utf8'));
    } catch {
      backupMeta = null;
    }
    const indexPath = findVaultIndexBackupFile(
      [extractDir, path.dirname(sourceRoot), sourceRoot],
      TUTANOTES_INDEX_BACKUP_FILE
    );
    const index =
      singlesId != null && indexPath
        ? readVaultIndexBackupFile(indexPath, await listVaultIndexBackupKeys(backupMeta), openVaultBuffer, isNotesVaultIndex)
            .index
        : null;

    await wipeVaultForPlainZipRestore(mountPath, { singlesId });
    const vaultRoot = vaultRootOnMount(mountPath);
    fs.mkdirSync(vaultRoot, { recursive: true });
    for (const name of fs.readdirSync(sourceRoot)) {
      if (isVaultIndexBackupFileName(name, TUTANOTES_INDEX_BACKUP_FILE)) continue;
      copyEntryRecursive(path.join(sourceRoot, name), path.join(vaultRoot, name));
    }
    if (index) {
      await importNotesMemberVaultIndex(singlesId, index, {
        vaultId: backupMeta?.vaultId ?? null,
        source: 'restore',
        importedFromPath: path.basename(indexPath)
      });
    }

    let restoredBytes = 0;
    for (const rel of relFiles) {
      try {
        restoredBytes += fs.statSync(path.join(vaultRoot, rel)).size;
      } catch {
        // ignore
      }
    }

    return { restoredFiles: relFiles.length, restoredBytes };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
