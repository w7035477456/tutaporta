import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BE_ROOT = path.resolve(__dirname, '../..');
const LEGACY_USB_DIR = path.join(BE_ROOT, 'usb');

const INSTALLERS = {
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

function contentTypeForPath(filePath, fallback) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (lower.endsWith('.exe')) return 'application/octet-stream';
  return fallback;
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

function firstExistingPath(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/** Folder from ~/.ssh/be/.env USB_DMG_EXE, else STORAGE_FOLDER/USB_DMG_EXE. */
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
  dirs.push(LEGACY_USB_DIR);
  const seen = new Set();
  return dirs.filter((d) => {
    if (!d || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

function resolveInstallerPath(platform) {
  const envKey =
    platform === 'mac'
      ? 'PHOTO_ALBUMS_BRIDGE_INSTALLER_MAC_PATH'
      : 'PHOTO_ALBUMS_BRIDGE_INSTALLER_WIN_PATH';
  const envPath = String(process.env[envKey] || '').trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const meta = INSTALLERS[platform];
  if (!meta) return null;

  for (const dir of resolveInstallerSearchDirs()) {
    const found = firstExistingPath(candidateInstallerPaths(dir, meta));
    if (found) return found;
  }
  return null;
}

/** Public paths the FE uses for Click Here (same-origin download). */
export function getPhotoAlbumsBridgeInstallerUrls() {
  return {
    mac: '/api/photoAlbums/bridge/installer/mac',
    win: '/api/photoAlbums/bridge/installer/win'
  };
}

/**
 * GET /api/photoAlbums/bridge/installer/:platform — mac (.zip) | win (.zip)
 * Auth required (user is on /myPhotoAlbums). Streams packaged installer when present.
 * Falls back to legacy .dmg / .exe if zip not present yet.
 */
export function downloadPhotoAlbumsBridgeInstaller(req, res) {
  const platform = String(req.params.platform || '')
    .trim()
    .toLowerCase();
  const meta = INSTALLERS[platform];
  if (!meta) {
    return res.status(400).json({ error: 'Use platform mac or win' });
  }

  const filePath = resolveInstallerPath(platform);
  const expectedDir = getUsbDmgExeDir() || LEGACY_USB_DIR;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({
      error: `USB Bridge installer not available on this server (${meta.fileName}). Expected under ${expectedDir}. Set USB_DMG_EXE in ~/.ssh/be/.env, then on a Mac run usball (builds + copies into USB_DMG_EXE).`
    });
  }

  const sendName = path.basename(filePath);
  res.setHeader('Content-Type', contentTypeForPath(filePath, meta.contentType));
  res.setHeader('Content-Disposition', `attachment; filename="${sendName}"`);
  return res.sendFile(path.resolve(filePath));
}
