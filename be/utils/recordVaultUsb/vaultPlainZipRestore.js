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
 */
export function wipeVaultForPlainZipRestore(mountPath) {
  const vaultRoot = vaultRootOnMount(mountPath);
  const photosRoot = vaultPhotosRoot(mountPath);
  try {
    const st = fs.lstatSync(photosRoot);
    if (st.isSymbolicLink()) fs.unlinkSync(photosRoot);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  removeDirRecursive(vaultRoot);
}

/**
 * Extract a plain vault zip into mountPath (parent of TutaNotes/).
 * @returns {{ restoredFiles: number, restoredBytes: number }}
 */
export async function restorePlainVaultZipToMount(mountPath, zipFilePath) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-vault-restore-'));
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
      throw new Error('Vault zip is empty');
    }

    wipeVaultForPlainZipRestore(mountPath);
    const vaultRoot = vaultRootOnMount(mountPath);
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

    return { restoredFiles: relFiles.length, restoredBytes };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
