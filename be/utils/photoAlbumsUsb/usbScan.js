import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import {
  REQUIRED_VAULT_PATHS,
  VAULT_DIR_NAME,
  vaultHasDbFile,
  vaultMetaPath,
  vaultRootOnMount
} from './vaultPaths.js';
import { readVolumeDiskInfo } from './volumeDiskInfo.js';
import { computeVaultFolderSizeBytes, parseGbFromBytes } from './vaultFolderSize.js';

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Bridge installer DMG / app volume names — not usable as TutaPhotoAlbums USB targets. */
function isBridgeInstallerVolumeLabel(label) {
  const name = String(label || '').trim().toLowerCase();
  if (!name) return false;
  return (
    /^record vault usb bridge(\s+\d+)?$/.test(name) ||
    /^tutaphotoalbums bridge installer(\s+\d+)?$/.test(name) ||
    /^omphotoalbums bridge installer(\s+\d+)?$/.test(name)
  );
}

function isWritableMount(mountPath) {
  try {
    fs.accessSync(mountPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Skip macOS disk-image mounts (installer DMGs) and read-only volumes. */
function isUnusableMacVaultMount(mountPath, label) {
  if (isBridgeInstallerVolumeLabel(label) || isBridgeInstallerVolumeLabel(path.basename(mountPath))) {
    return true;
  }
  if (!isWritableMount(mountPath)) {
    return true;
  }
  try {
    const out = execFileSync('diskutil', ['info', mountPath], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    if (/Protocol:\s*Disk Image/i.test(out)) return true;
    if (/Read-Only Volume:\s*Yes/i.test(out)) return true;
    if (/Read-Only Media:\s*Yes/i.test(out)) return true;
  } catch {
    // If diskutil fails, still allow writable non-installer mounts.
  }
  return false;
}

function readVaultMeta(mountPath) {
  try {
    let raw = fs.readFileSync(vaultMetaPath(mountPath), 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function quickVaultStatus(mountPath) {
  const root = vaultRootOnMount(mountPath);
  if (!isDirectory(root)) {
    return { hasVault: false };
  }
  const meta = readVaultMeta(mountPath);
  if (!meta?.vaultId) {
    return { hasVault: false, partial: true };
  }
  if (Number(meta.version) === 1) {
    return { hasVault: true, vaultId: meta.vaultId || null, legacyPinVault: true };
  }
  if (Number(meta.version) === 3 || meta.encryption === 'none') {
    if (!vaultHasDbFile(mountPath)) {
      return { hasVault: false, partial: true };
    }
    return { hasVault: true, vaultId: meta.vaultId || null };
  }
  if (Number(meta.version) !== 2) {
    return { hasVault: false, partial: true };
  }
  if (!vaultHasDbFile(mountPath)) {
    return { hasVault: false, partial: true };
  }
  return { hasVault: true, vaultId: meta.vaultId || null };
}

function vaultStatusForPath(mountPath) {
  const quick = quickVaultStatus(mountPath);
  if (!quick.hasVault && !quick.partial) {
    return quick;
  }
  const check = verifyVaultStructure(mountPath);
  if (check.ok) {
    return {
      hasVault: true,
      vaultId: check.meta?.vaultId || null,
      legacyPinVault: Boolean(check.legacyPinVault)
    };
  }
  // TutaPhotoAlbums folder present but missing meta/db/photos/files → not a valid vault.
  if (quick.hasVault || quick.partial || isDirectory(vaultRootOnMount(mountPath))) {
    return { hasVault: false, partial: true };
  }
  return { hasVault: false };
}

function locationEntry(mountPath, label, platform) {
  const status = vaultStatusForPath(mountPath);
  const disk = readVolumeDiskInfo(mountPath, platform);
  const vaultUsedBytes = computeVaultFolderSizeBytes(mountPath);
  return {
    mountPath,
    label,
    platform,
    hasVault: status.hasVault,
    vaultId: status.vaultId || null,
    partial: status.partial || false,
    legacyPinVault: status.legacyPinVault || false,
    sizeGb: disk.sizeGb,
    availGb: disk.availGb,
    freePercent: disk.freePercent,
    fileSystem: disk.fileSystem,
    vaultUsedBytes,
    vaultUsedGb: parseGbFromBytes(vaultUsedBytes) ?? 0
  };
}

function verifyVaultStructure(mountPath) {
  const root = vaultRootOnMount(mountPath);
  if (!isDirectory(root)) {
    return { ok: false, error: `Missing ${VAULT_DIR_NAME} folder on USB` };
  }
  for (const rel of REQUIRED_VAULT_PATHS) {
    const abs = path.join(root, rel);
    if (rel.endsWith('.json')) {
      if (!fs.existsSync(abs)) {
        return { ok: false, error: `Missing required file: ${rel}` };
      }
    } else if (!isDirectory(abs)) {
      return { ok: false, error: `Missing required folder: ${rel}` };
    }
  }
  if (!vaultHasDbFile(mountPath)) {
    return { ok: false, error: 'Missing required file: vault database' };
  }
  const meta = readVaultMeta(mountPath);
  if (!meta?.vaultId) {
    return { ok: false, error: 'Invalid or unreadable vault.meta.json' };
  }
  if (Number(meta.version) === 1) {
    return { ok: true, meta, legacyPinVault: true };
  }
  if (Number(meta.version) === 3 || meta.encryption === 'none') {
    return { ok: true, meta };
  }
  if (Number(meta.version) !== 2 || meta.encryption !== 'aes-256-gcm-icon-key') {
    return { ok: false, error: 'Invalid or unreadable vault.meta.json' };
  }
  return { ok: true, meta };
}

function scanMacVolumes() {
  const volumesRoot = '/Volumes';
  if (!isDirectory(volumesRoot)) return [];
  const found = [];
  for (const name of fs.readdirSync(volumesRoot)) {
    if (name.startsWith('.')) continue;
    const mountPath = path.join(volumesRoot, name);
    if (!isDirectory(mountPath)) continue;
    if (isUnusableMacVaultMount(mountPath, name)) continue;
    const check = verifyVaultStructure(mountPath);
    if (check.ok) {
      found.push({
        mountPath,
        label: name,
        vaultId: check.meta.vaultId || null,
        platform: 'darwin'
      });
    }
  }
  return found;
}

function listMacVolumeLocations() {
  const volumesRoot = '/Volumes';
  if (!isDirectory(volumesRoot)) return [];
  const locations = [];
  for (const name of fs.readdirSync(volumesRoot)) {
    if (name.startsWith('.')) continue;
    const mountPath = path.join(volumesRoot, name);
    if (!isDirectory(mountPath)) continue;
    if (isUnusableMacVaultMount(mountPath, name)) continue;
    locations.push(locationEntry(mountPath, name, 'darwin'));
  }
  locations.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return locations;
}

function scanWindowsDrives() {
  if (process.platform !== 'win32') return [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const found = [];
  for (const letter of letters) {
    const mountPath = `${letter}:\\`;
    try {
      if (!fs.existsSync(mountPath)) continue;
    } catch {
      continue;
    }
    const check = verifyVaultStructure(mountPath);
    if (check.ok) {
      found.push({
        mountPath,
        label: `${letter}:`,
        vaultId: check.meta.vaultId || null,
        platform: 'win32'
      });
    }
  }
  return found;
}

function listWindowsDriveLocations() {
  if (process.platform !== 'win32') return [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const locations = [];
  for (const letter of letters) {
    const mountPath = `${letter}:\\`;
    try {
      if (!fs.existsSync(mountPath)) continue;
    } catch {
      continue;
    }
    locations.push(locationEntry(mountPath, `${letter}:`, 'win32'));
  }
  return locations;
}

function scanLinuxVolumes() {
  const mediaRoot = path.join('/media', os.userInfo().username);
  if (!isDirectory(mediaRoot)) return [];
  const found = [];
  for (const name of fs.readdirSync(mediaRoot)) {
    const mountPath = path.join(mediaRoot, name);
    if (!isDirectory(mountPath)) continue;
    const check = verifyVaultStructure(mountPath);
    if (check.ok) {
      found.push({
        mountPath,
        label: name,
        vaultId: check.meta.vaultId || null,
        platform: 'linux'
      });
    }
  }
  return found;
}

function listLinuxVolumeLocations() {
  const mediaRoot = path.join('/media', os.userInfo().username);
  if (!isDirectory(mediaRoot)) return [];
  const locations = [];
  for (const name of fs.readdirSync(mediaRoot)) {
    const mountPath = path.join(mediaRoot, name);
    if (!isDirectory(mountPath)) continue;
    locations.push(locationEntry(mountPath, name, 'linux'));
  }
  locations.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return locations;
}

function allowedBrowseRoots() {
  if (process.platform === 'win32') {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => `${l}:\\`);
  }
  if (process.platform === 'darwin') {
    return ['/Volumes'];
  }
  return [path.join('/media', os.userInfo().username)];
}

function isPathUnderAllowedRoots(absPath) {
  const normalized = path.resolve(absPath);
  const roots = allowedBrowseRoots();
  return roots.some((root) => {
    const rootResolved = path.resolve(root);
    return normalized === rootResolved || normalized.startsWith(`${rootResolved}${path.sep}`);
  });
}

/** Returns the mount entry when path is a top-level volume root; throws otherwise. */
export function resolveVolumeRootMountPath(mountPath) {
  const normalized = path.resolve(String(mountPath ?? '').trim());
  if (!normalized) {
    throw new Error('USB drive path is required');
  }
  const match = listMountLocations().find((loc) => path.resolve(loc.mountPath) === normalized);
  if (!match) {
    throw new Error('Pick a mounted USB drive from the list (entire drive root only)');
  }
  return match;
}

/** List top-level mount locations (Finder sidebar style). */
export function listMountLocations() {
  if (process.platform === 'win32') return listWindowsDriveLocations();
  if (process.platform === 'darwin') return listMacVolumeLocations();
  return listLinuxVolumeLocations();
}

/** Browse subfolders under an allowed mount path. */
export function browseMountPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') {
    return { ok: false, error: 'Path is required' };
  }
  const absPath = path.resolve(rawPath.trim());
  if (!fs.existsSync(absPath)) {
    return { ok: false, error: 'Path not found' };
  }
  if (!isDirectory(absPath)) {
    return { ok: false, error: 'Path is not a folder' };
  }
  if (!isPathUnderAllowedRoots(absPath)) {
    return { ok: false, error: 'Path is outside allowed USB / volume locations' };
  }

  const parentPath = path.dirname(absPath);
  const canGoUp = isPathUnderAllowedRoots(parentPath) && parentPath !== absPath;
  const vaultHere = vaultStatusForPath(absPath);
  const folders = [];
  const MAX_FOLDERS = 300;

  let entries = [];
  try {
    entries = fs.readdirSync(absPath, { withFileTypes: true });
  } catch (err) {
    return { ok: false, error: err?.message || 'Unable to read folder' };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const folderPath = path.join(absPath, entry.name);
    const status = vaultStatusForPath(folderPath);
    folders.push({
      name: entry.name,
      path: folderPath,
      hasVault: status.hasVault,
      vaultId: status.vaultId || null,
      partial: status.partial || false,
      legacyPinVault: status.legacyPinVault || false
    });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return {
    ok: true,
    path: absPath,
    label: path.basename(absPath),
    parentPath: canGoUp ? parentPath : null,
    hasVault: vaultHere.hasVault,
    vaultId: vaultHere.vaultId || null,
    partial: vaultHere.partial || false,
    legacyPinVault: vaultHere.legacyPinVault || false,
    folders: folders.slice(0, MAX_FOLDERS),
    truncated: folders.length > MAX_FOLDERS
  };
}

/** Scan removable mounts for a valid Record Vault USB bundle. */
export function scanForPhotoAlbumsUsb() {
  if (process.platform === 'win32') return scanWindowsDrives();
  if (process.platform === 'darwin') return scanMacVolumes();
  return scanLinuxVolumes();
}

export function validateVaultOnMount(mountPath) {
  if (!mountPath || typeof mountPath !== 'string') {
    return { ok: false, error: 'Mount path is required' };
  }
  const normalized = path.resolve(mountPath);
  if (!fs.existsSync(normalized)) {
    return { ok: false, error: 'USB path not found' };
  }
  return verifyVaultStructure(normalized);
}

export { verifyVaultStructure, readVaultMeta };
