import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZipArchive } from 'archiver';
import { Extract } from 'unzipper';
import { trackVaultTransferBytes } from '../vaultTransferTracking.js';
import { VAULT_META_FILE } from '../recordVaultUsb/vaultPaths.js';
import { getOneDriveVaultFolderName, upsertOneDriveFileAtPath, downloadOneDriveFile, listOneDriveChildren } from './oneDriveApi.js';
import { getAccessTokenForSingles } from './oneDriveVaultSync.js';

async function downloadOneDriveTree(accessToken, folderId, localRoot) {
  fs.mkdirSync(localRoot, { recursive: true });
  const children = await listOneDriveChildren(accessToken, folderId);
  for (const child of children) {
    const name = String(child?.name || '');
    if (!name) continue;
    const localPath = path.join(localRoot, name);
    if (child.folder) {
      fs.mkdirSync(localPath, { recursive: true });
      await downloadOneDriveTree(accessToken, child.id, localPath);
      continue;
    }
    const buf = await downloadOneDriveFile(accessToken, child.id);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buf);
  }
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

function resolveVaultRootFromExtractedDir(extractDir) {
  const folderName = getOneDriveVaultFolderName();
  const namedRoot = path.join(extractDir, folderName);
  if (fs.existsSync(path.join(namedRoot, VAULT_META_FILE))) {
    return namedRoot;
  }
  if (fs.existsSync(path.join(extractDir, VAULT_META_FILE))) {
    return extractDir;
  }
  throw new Error(`Backup zip must contain a ${folderName} folder with ${VAULT_META_FILE}`);
}

function formatMyNoteBackupZipStamp(date = new Date()) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  let hours = date.getHours();
  const tt = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  let tz = 'Local';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date);
    const rawTz = parts.find((part) => part.type === 'timeZoneName')?.value || '';
    tz = String(rawTz).replace(/[^A-Za-z0-9_+-]/g, '') || 'Local';
  } catch {
    // keep Local
  }
  return `${y}-${mo}-${d}_${hh}-${mi}-${ss}_${tt}_${tz}`;
}

/** @param {'onedrive' | 'usb'} kind */
export function buildMyNoteBackupZipFileName(kind = 'onedrive') {
  const prefix = kind === 'usb' ? 'MyNote_USB' : 'MyNote_OneDrive';
  return `${prefix}_${formatMyNoteBackupZipStamp()}.zip`;
}

function backupZipFileName() {
  return buildMyNoteBackupZipFileName('onedrive');
}

/** Stream a zip of the entire OneDrive vault folder (onlinemallwebsitevault) to the HTTP response. */
export async function streamOneDriveVaultBackupZip(singlesId, res) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up yet');
  }

  const folderName = getOneDriveVaultFolderName();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-backup-'));
  const vaultLocalRoot = path.join(tmpRoot, folderName);

  try {
    await downloadOneDriveTree(accessToken, folderId, vaultLocalRoot);

    const zipName = backupZipFileName();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    await new Promise((resolve, reject) => {
      archive.on('error', reject);
      archive.on('end', resolve);
      archive.pipe(res);
      archive.directory(vaultLocalRoot, folderName);
      void archive.finalize();
    });
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

/** Restore OneDrive vault contents from a local zip file path. */
export async function restoreOneDriveVaultFromZipFile(singlesId, zipFilePath) {
  const { accessToken, folderId } = await getAccessTokenForSingles(singlesId);
  if (!folderId) {
    throw new Error('OneDrive vault folder is not set up yet');
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-restore-'));
  const extractDir = path.join(tmpRoot, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    await fs
      .createReadStream(zipFilePath)
      .pipe(Extract({ path: extractDir }))
      .promise();

    const vaultRoot = resolveVaultRootFromExtractedDir(extractDir);
    const relFiles = walkLocalFiles(vaultRoot);
    if (!relFiles.length) {
      throw new Error('Backup zip is empty');
    }

    let restoredFiles = 0;
    let restoredBytes = 0;
    for (const rel of relFiles) {
      const abs = path.join(vaultRoot, rel);
      const buf = fs.readFileSync(abs);
      await upsertOneDriveFileAtPath(accessToken, folderId, rel, buf);
      restoredFiles += 1;
      restoredBytes += buf.length;
    }

    // Restore runs from the gate before the workspace is open — count bytes, do not throttle.
    await trackVaultTransferBytes(singlesId, restoredBytes);
    return { restoredFiles, restoredBytes, folderName: getOneDriveVaultFolderName() };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
