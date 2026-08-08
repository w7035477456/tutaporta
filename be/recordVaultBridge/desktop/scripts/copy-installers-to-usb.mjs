/**
 * Copy packaged USB bridge installers for website download.
 * Prefer USB_DMG_EXE from env / ~/.ssh/be/.env; fallback be/usb/.
 *
 * Publishes platform zips (unsigned-friendly Mac distribution):
 *   usbBridgeV3-mac.zip  — from electron-builder Mac zip (contains .app)
 *   usbBridgeV3-win.zip  — wraps usbBridgeV3.exe
 */
import { execFileSync } from 'child_process';
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

function loadUsbDmgExeFromHomeEnv() {
  loadEnvKeyFromHomeEnv('STORAGE_FOLDER');
  loadEnvKeyFromHomeEnv('USB_DMG_EXE');
}

loadUsbDmgExeFromHomeEnv();

/** Expand ${STORAGE_FOLDER} / $STORAGE_FOLDER inside USB_DMG_EXE. */
function expandUsbDmgExeEnv() {
  const storage = String(process.env.STORAGE_FOLDER || '')
    .trim()
    .replace(/\/+$/, '');
  let usb = String(process.env.USB_DMG_EXE || '').trim();
  if (!usb) return;
  if (storage) {
    usb = usb.replace(/\$\{STORAGE_FOLDER\}/g, storage).replace(/\$STORAGE_FOLDER/g, storage);
  }
  process.env.USB_DMG_EXE = usb.replace(/\/+$/, '');
}

expandUsbDmgExeEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const beRoot = path.resolve(desktopDir, '..', '..');
const repoRoot = path.resolve(beRoot, '..');
const distDir = path.join(desktopDir, 'dist');
const legacyUsbDir = path.join(beRoot, 'usb');
const repoUsbzipDir = path.join(repoRoot, 'usbzip');

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

/** Also stage into repo usbzip/ for git commit + Ubuntu work2 publish. */
function mirrorToRepoUsbzip(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  ensureDir(repoUsbzipDir);
  const dest = path.join(repoUsbzipDir, path.basename(filePath));
  fs.copyFileSync(filePath, dest);
  console.log(`[copy-installers-to-usb] mirrored -> ${dest} (commit this for Ubuntu work2)`);
}

/** electron-builder Mac zip → usbBridgeV3-mac.zip (+ Open .command for Gatekeeper). */
function publishMacZip(destDir) {
  const candidates = [
    path.join(distDir, 'usbBridgeV3.zip'),
    path.join(distDir, 'usbBridgeV3-mac.zip')
  ];
  const src = candidates.find((p) => fs.existsSync(p));
  if (!src) {
    console.log('[copy-installers-to-usb] skip (not built): Mac zip');
    return false;
  }

  const dest = path.join(destDir, 'usbBridgeV3-mac.zip');
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'usbBridgeV3-mac-'));
  try {
    execFileSync('unzip', ['-o', '-q', src, '-d', stagingRoot], { stdio: 'inherit' });
    const appPath = path.join(stagingRoot, 'usbBridgeV3.app');
    if (!fs.existsSync(appPath)) {
      console.error('[copy-installers-to-usb] Mac zip missing usbBridgeV3.app after unzip');
      return false;
    }

    // End-user Mac zip: instructions + .command opener (webloc x-apple.* URLs fail on Sequoia).
    const macEndUserDir = path.join(__dirname, '..', 'mac-end-user');
    const startHereName = '1-START-HERE-Read-Me-First.txt';
    const privacyOpenName = '2-Open-Privacy-Settings.command';
    const startHereSrc = path.join(macEndUserDir, startHereName);
    const privacyOpenSrc = path.join(macEndUserDir, privacyOpenName);
    if (!fs.existsSync(startHereSrc) || !fs.existsSync(privacyOpenSrc)) {
      console.error(
        '[copy-installers-to-usb] missing mac-end-user instructions:',
        startHereSrc,
        privacyOpenSrc
      );
      return false;
    }
    fs.copyFileSync(startHereSrc, path.join(stagingRoot, startHereName));
    const privacyOpenDest = path.join(stagingRoot, privacyOpenName);
    fs.copyFileSync(privacyOpenSrc, privacyOpenDest);
    fs.chmodSync(privacyOpenDest, 0o755);

    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    execFileSync(
      'zip',
      ['-r', '-q', '-y', dest, 'usbBridgeV3.app', startHereName, privacyOpenName],
      {
        cwd: stagingRoot,
        stdio: 'inherit'
      }
    );
    console.log(
      `[copy-installers-to-usb] ${src} -> ${dest} (with ${startHereName} + ${privacyOpenName})`
    );
    mirrorToRepoUsbzip(dest);
    return true;
  } catch (err) {
    console.error(
      '[copy-installers-to-usb] failed to publish Mac zip with Open .command:',
      err?.message || err
    );
    return false;
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
}

/** Wrap NSIS usbBridgeV3.exe in usbBridgeV3-win.zip */
function publishWinZip(destDir) {
  const exeSrc = path.join(distDir, 'usbBridgeV3.exe');
  if (!fs.existsSync(exeSrc)) {
    console.log('[copy-installers-to-usb] skip (not built): usbBridgeV3.exe');
    return false;
  }
  const destZip = path.join(destDir, 'usbBridgeV3-win.zip');
  const stagingZip = path.join(distDir, 'usbBridgeV3-win.zip');
  try {
    if (fs.existsSync(stagingZip)) fs.unlinkSync(stagingZip);
    execFileSync('zip', ['-j', '-q', stagingZip, exeSrc], { stdio: 'inherit' });
  } catch (err) {
    console.error(
      '[copy-installers-to-usb] failed to zip Windows exe (need `zip` on PATH):',
      err?.message || err
    );
    return false;
  }
  copyFile(stagingZip, destZip);
  mirrorToRepoUsbzip(destZip);
  return true;
}

const destDir = resolveDestDir();
ensureDir(destDir);
const copied = [publishMacZip(destDir), publishWinZip(destDir)].filter(Boolean);
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
