/**
 * Resolve USB Bridge installer files under USB_DMG_EXE (storage), not git.
 *
 * Long-term: build on Mac (`usball` → copy-installers-to-usb.mjs), then
 * `scripts/sync-usb-bridge-installers.sh` to Ubuntu USB_DMG_EXE.
 * Never serve Git LFS pointer stubs checked out without `git lfs pull`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isIncludeUsbDmgExeEnabled } from './includeUsbDmgExeConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const USB_BRIDGE_LEGACY_USB_DIR = path.resolve(__dirname, '..', 'usb');

export const USB_BRIDGE_INSTALLERS = {
  mac: {
    fileName: 'usbBridgeV3-mac.zip',
    alternateFileNames: ['usbBridgeV3.zip', 'usbBridgeV3.dmg'],
    contentType: 'application/zip'
  },
  win: {
    fileName: 'usbBridgeV3-win.zip',
    alternateFileNames: ['usbBridgeV3.exe'],
    contentType: 'application/zip'
  }
};

/** @returns {string} absolute USB_DMG_EXE dir or '' */
export function getUsbDmgExeDir() {
  const fromEnv = String(process.env.USB_DMG_EXE || '')
    .trim()
    .replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const storage = String(process.env.STORAGE_FOLDER || '')
    .trim()
    .replace(/\/+$/, '');
  if (storage) return path.join(storage, 'USB_DMG_EXE');
  return '';
}

export function contentTypeForInstallerPath(filePath, fallback) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (lower.endsWith('.exe')) return 'application/octet-stream';
  return fallback;
}

/** True when file is a Git LFS pointer text stub (typical ~130 bytes), not the real binary. */
export function isGitLfsPointerFile(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size > 1024) return false;
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(80);
      const n = fs.readSync(fd, buf, 0, 80, 0);
      return buf.slice(0, n).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/** ZIP local file header magic "PK". */
export function isZipArchiveFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(4);
      const n = fs.readSync(fd, buf, 0, 4, 0);
      return n >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Reject LFS stubs and non-zip files when the expected artifact is a .zip.
 * Legacy .dmg / .exe alternates only need to exist and not be LFS pointers.
 */
export function isUsableInstallerFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (isGitLfsPointerFile(filePath)) return false;
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith('.zip')) return isZipArchiveFile(filePath);
  try {
    return fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 1024;
  } catch {
    return false;
  }
}

function candidateInstallerPaths(dir, meta) {
  if (!dir || !meta) return [];
  const names = [meta.fileName, ...(meta.alternateFileNames || [])];
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const key = String(name || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(path.join(dir, key));
  }
  return out;
}

function resolveInstallerSearchDirs() {
  const dirs = [];
  const usbDmgExeDir = getUsbDmgExeDir();
  if (usbDmgExeDir) dirs.push(usbDmgExeDir);
  const storage = String(process.env.STORAGE_FOLDER || '')
    .trim()
    .replace(/\/+$/, '');
  if (storage) {
    dirs.push(storage);
    dirs.push(path.join(storage, 'USB_DMG_EXE'));
  }
  dirs.push(USB_BRIDGE_LEGACY_USB_DIR);
  const seen = new Set();
  return dirs.filter((d) => {
    if (!d || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

/**
 * @param {'mac'|'win'} platform
 * @param {{ macPathEnv?: string, winPathEnv?: string }} [pathEnv]
 */
export function resolveUsbBridgeInstallerPath(
  platform,
  pathEnv = {
    macPathEnv: 'RECORD_VAULT_BRIDGE_INSTALLER_MAC_PATH',
    winPathEnv: 'RECORD_VAULT_BRIDGE_INSTALLER_WIN_PATH'
  }
) {
  if (!isIncludeUsbDmgExeEnabled()) return null;
  const envKey = platform === 'mac' ? pathEnv.macPathEnv : pathEnv.winPathEnv;
  const envPath = String(process.env[envKey] || '').trim();
  if (envPath && isUsableInstallerFile(envPath)) return envPath;

  const meta = USB_BRIDGE_INSTALLERS[platform];
  if (!meta) return null;

  for (const dir of resolveInstallerSearchDirs()) {
    for (const candidate of candidateInstallerPaths(dir, meta)) {
      if (isUsableInstallerFile(candidate)) return candidate;
    }
  }
  return null;
}

export function usbBridgeInstallerMissingMessage(platform) {
  if (!isIncludeUsbDmgExeEnabled()) {
    return 'USB Bridge is disabled on this server (INCLUDE_USB_DMG_EXE=false).';
  }
  const meta = USB_BRIDGE_INSTALLERS[platform];
  const expectedDir = getUsbDmgExeDir() || USB_BRIDGE_LEGACY_USB_DIR;
  const name = meta?.fileName || 'installer';
  return (
    `USB Bridge installer not available on this server (${name}). ` +
    `Expected a real zip under ${expectedDir} (not a Git LFS pointer). ` +
    `On Mac: usball, then scripts/sync-usb-bridge-installers.sh`
  );
}
