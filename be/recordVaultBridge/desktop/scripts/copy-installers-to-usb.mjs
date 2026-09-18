/**
 * Copy packaged USB bridge installers for website download.
 * Prefer USB_DMG_EXE from env / ~/.ssh/be/.env; fallback be/usb/.
 *
 * Copies electron-builder artifacts as-is (no zip repackaging):
 *   usbBridgeV3.dmg  — Mac
 *   usbBridgeV3.exe  — Windows (NSIS)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

function loadEnvKeyFromHomeEnv(key) {
  if (String(process.env[key] || '').trim()) return;
  const homeEnvPath = path.join(os.homedir(), '.ssh', 'be', '.env');
  if (!fs.existsSync(homeEnvPath)) return;
  const text = fs.readFileSync(homeEnvPath, 'utf8');
  const re = new RegExp('^' + key + '\\s*=\\s*(.*)$');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = re.exec(trimmed);
    if (!m) continue;
    let val = m[1].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const hash = val.indexOf(' #');
    if (hash >= 0) val = val.slice(0, hash).trim();
    if (val) process.env[key] = val;
    break;
  }
}

function isIncludeUsbDmgExeEnabled() {
  const raw = String(process.env.INCLUDE_USB_DMG_EXE ?? 'true').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(raw);
}

function loadUsbDmgExeFromHomeEnv() {
  loadEnvKeyFromHomeEnv('INCLUDE_USB_DMG_EXE');
  loadEnvKeyFromHomeEnv('FAST_STORAGE_FOLDER');
  loadEnvKeyFromHomeEnv('USB_DMG_EXE');
}

loadUsbDmgExeFromHomeEnv();

if (!isIncludeUsbDmgExeEnabled()) {
  console.log('[copy-installers-to-usb] SKIP — INCLUDE_USB_DMG_EXE=false');
  process.exit(0);
}

/** Expand ${FAST_STORAGE_FOLDER} / $FAST_STORAGE_FOLDER inside USB_DMG_EXE. */
function expandUsbDmgExeEnv() {
  const storage = String(process.env.FAST_STORAGE_FOLDER || '')
    .trim()
    .replace(/\/+$/, '');
  let usb = String(process.env.USB_DMG_EXE || '').trim();
  if (!usb) return;
  if (storage) {
    usb = usb.replace(/\$\{FAST_STORAGE_FOLDER\}/g, storage).replace(/\$FAST_STORAGE_FOLDER/g, storage);
  }
  process.env.USB_DMG_EXE = usb.replace(/\/+$/, '');
}

expandUsbDmgExeEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const beRoot = path.resolve(desktopDir, '..', '..');
const distDir = path.join(desktopDir, 'dist');
const legacyUsbDir = path.join(beRoot, 'usb');

function resolveDestDir() {
  const fromEnv = String(process.env.USB_DMG_EXE || '')
    .trim()
    .replace(/\/+$/, '');
  return fromEnv || legacyUsbDir;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`[copy-installers-to-usb] ${src} -> ${dest}`);
}

function publishMacDmg(destDir) {
  const src = path.join(distDir, 'usbBridgeV3.dmg');
  if (!fs.existsSync(src)) {
    console.log('[copy-installers-to-usb] skip (not built): usbBridgeV3.dmg');
    return false;
  }
  copyFile(src, path.join(destDir, 'usbBridgeV3.dmg'));
  return true;
}

function publishWinExe(destDir) {
  const src = path.join(distDir, 'usbBridgeV3.exe');
  if (!fs.existsSync(src)) {
    console.log('[copy-installers-to-usb] skip (not built): usbBridgeV3.exe');
    return false;
  }
  copyFile(src, path.join(destDir, 'usbBridgeV3.exe'));
  return true;
}

const destDir = resolveDestDir();
ensureDir(destDir);
const copied = [publishMacDmg(destDir), publishWinExe(destDir)].filter(Boolean);
if (copied.length === 0) {
  console.warn(
    '[copy-installers-to-usb] no installers found in dist/ — run dist:mac or dist:win first'
  );
} else {
  console.log(`[copy-installers-to-usb] done (${copied.length} file(s) in ${destDir})`);
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log(`[copy-installers-to-usb] removed build artifacts: ${distDir}`);
  }
}
