const { app, BrowserWindow, Menu, Tray, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

process.env.RECORD_VAULT_BRIDGE_STANDALONE = '1';

const BRIDGE_PORT = Number(process.env.RECORD_VAULT_BRIDGE_PORT || 49201);
const HEALTH_URL = `http://127.0.0.1:${BRIDGE_PORT}/health`;
const LOCATIONS_URL = `http://127.0.0.1:${BRIDGE_PORT}/api/recordVault/usb/locations`;
const STATUS_POLL_MS = 2000;

let tray = null;
let statusWindow = null;
let bridgeStarted = false;
let bridgeError = '';
let statusPollTimer = null;
let appIsQuitting = false;
/** @type {{ state: string, title: string, message: string, detail: string, drives: string[] }} */
let lastStatus = {
  state: 'notconnected',
  title: 'USB Not Connected',
  message: 'Starting local USB bridge…',
  detail: '',
  drives: []
};

function bridgeRootDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'be');
  }
  return path.resolve(__dirname, '..', '..');
}

function iconPath() {
  const packaged = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(process.resourcesPath, 'assets', 'icon.png');
}

function statusHtmlPath() {
  return path.join(__dirname, 'status.html');
}

function isDarwinUsbProtocolMount(mountPath) {
  try {
    const out = execFileSync('diskutil', ['info', mountPath], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    if (/Protocol:\s*Disk Image/i.test(out)) return false;
    if (/Protocol:\s*USB/i.test(out)) return true;
    if (/Protocol:\s*Secure Digital/i.test(out)) return true;
    if (/Protocol:\s*Thunderbolt/i.test(out) && /Removable Media:\s*Yes/i.test(out)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Mount path still exists and is readable (filters stale /Volumes ghosts). */
function isLiveMountPath(mountPath) {
  const abs = String(mountPath || '').trim();
  if (!abs) return false;
  try {
    if (!fs.existsSync(abs)) return false;
    const st = fs.statSync(abs);
    if (!st.isDirectory()) return false;
    fs.accessSync(abs, fs.constants.R_OK);
    fs.readdirSync(abs);
    return true;
  } catch {
    return false;
  }
}

function isLikelyRemovableUsbLocation(loc) {
  const mountPath = String(loc?.mountPath || '').trim();
  const label = String(loc?.label || path.basename(mountPath) || '').trim();
  if (!mountPath || !isLiveMountPath(mountPath)) return false;

  if (process.platform === 'darwin') {
    return isDarwinUsbProtocolMount(mountPath);
  }

  if (process.platform === 'win32') {
    const systemDrive = String(process.env.SystemDrive || 'C:').replace(/\\+$/, '').toUpperCase();
    const drive = mountPath.slice(0, 2).toUpperCase();
    if (drive === systemDrive) return false;
    return /^[A-Z]:$/i.test(drive);
  }

  return Boolean(label);
}

/**
 * Status window "Connected" = TutaNotes vault USB present (hasVault/partial).
 * Other sticks (e.g. MSWord2010 with no vault) must not keep the UI green
 * after the vault USB is unplugged — that matches website View USB.
 */
function isTutaNotesVaultUsbLocation(loc) {
  if (!isLikelyRemovableUsbLocation(loc)) return false;
  return Boolean(loc?.hasVault) || Boolean(loc?.partial);
}

function setTrayTooltip() {
  if (!tray) return;
  if (lastStatus.state === 'connected') {
    const driveText = lastStatus.drives.length ? ` — ${lastStatus.drives.join(', ')}` : '';
    tray.setToolTip(`Record Vault USB Bridge — USB Connected & Ready${driveText}`);
    return;
  }
  if (lastStatus.state === 'nousb') {
    tray.setToolTip('Record Vault USB Bridge — USB Not Plugged In');
    return;
  }
  if (lastStatus.state === 'needinstall') {
    tray.setToolTip('Record Vault USB Bridge — Need install');
    return;
  }
  tray.setToolTip('Record Vault USB Bridge — USB Not Connected');
}

function pushStatusToWindow(payload) {
  lastStatus = payload;
  setTrayTooltip();
  refreshTrayMenu();
  if (!statusWindow || statusWindow.isDestroyed()) return;
  const js = `window.__setBridgeStatus && window.__setBridgeStatus(${JSON.stringify(payload)});`;
  statusWindow.webContents.executeJavaScript(js).catch(() => {});
}

function buildStatusPayloadFromBridge(locations) {
  const allUsb = (Array.isArray(locations) ? locations : []).filter(isLikelyRemovableUsbLocation);
  const vaultUsb = allUsb.filter(isTutaNotesVaultUsbLocation);
  const drives = vaultUsb.map((loc) => String(loc.label || path.basename(loc.mountPath)).trim()).filter(Boolean);
  const listen = `Listening on 127.0.0.1:${BRIDGE_PORT}`;

  if (!bridgeStarted) {
    if (bridgeError) {
      return {
        state: 'needinstall',
        title: 'Need install',
        message: bridgeError,
        detail: listen,
        drives: []
      };
    }
    return {
      state: 'notconnected',
      title: 'USB Not Connected',
      message: 'Local USB bridge is starting…',
      detail: listen,
      drives: []
    };
  }

  if (!drives.length) {
    const otherUsb = allUsb
      .filter((loc) => !isTutaNotesVaultUsbLocation(loc))
      .map((loc) => String(loc.label || path.basename(loc.mountPath)).trim())
      .filter(Boolean);
    if (otherUsb.length) {
      return {
        state: 'notconnected',
        title: 'USB Not Connected',
        message: 'USB drive present, but no TutaNotes vault on it.',
        detail: listen,
        drives: otherUsb
      };
    }
    return {
      state: 'nousb',
      title: 'USB Not Plugged In',
      message: 'Bridge is connected, but no USB drive is plugged in.',
      detail: listen,
      drives: []
    };
  }

  return {
    state: 'connected',
    title: 'USB Connected & Ready',
    message: 'USB bridge is online and an TutaNotes USB vault is ready.',
    detail: listen,
    drives
  };
}

async function refreshBridgeStatus() {
  const listen = `Listening on 127.0.0.1:${BRIDGE_PORT}`;
  if (!bridgeStarted) {
    pushStatusToWindow({
      state: bridgeError ? 'needinstall' : 'notconnected',
      title: bridgeError ? 'Need install' : 'USB Not Connected',
      message: bridgeError || 'Starting local USB bridge…',
      detail: listen,
      drives: []
    });
    return;
  }

  try {
    const healthRes = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) {
      pushStatusToWindow({
        state: 'needinstall',
        title: 'Need install',
        message: `Bridge health check failed (${healthRes.status})`,
        detail: listen,
        drives: []
      });
      return;
    }

    const locRes = await fetch(LOCATIONS_URL, { signal: AbortSignal.timeout(5000) });
    if (!locRes.ok) {
      pushStatusToWindow({
        state: 'notconnected',
        title: 'USB Not Connected',
        message: `Unable to list USB volumes (${locRes.status})`,
        detail: listen,
        drives: []
      });
      return;
    }
    const body = await locRes.json();
    pushStatusToWindow(buildStatusPayloadFromBridge(body?.locations));
  } catch (err) {
    pushStatusToWindow({
      state: 'needinstall',
      title: 'Need install',
      message: String(err?.message || err),
      detail: listen,
      drives: []
    });
  }
}

function startStatusPolling() {
  if (statusPollTimer) return;
  void refreshBridgeStatus();
  statusPollTimer = setInterval(() => {
    void refreshBridgeStatus();
  }, STATUS_POLL_MS);
}

function stopStatusPolling() {
  if (!statusPollTimer) return;
  clearInterval(statusPollTimer);
  statusPollTimer = null;
}

function createStatusWindow() {
  if (!app.isReady()) {
    void app.whenReady().then(() => createStatusWindow());
    return;
  }
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.show();
    statusWindow.focus();
    pushStatusToWindow(lastStatus);
    return;
  }

  statusWindow = new BrowserWindow({
    width: 520,
    height: 160,
    minWidth: 420,
    minHeight: 130,
    title: 'Record Vault USB Bridge',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  statusWindow.once('ready-to-show', () => {
    statusWindow.show();
    pushStatusToWindow(lastStatus);
  });

  statusWindow.on('close', (event) => {
    if (!appIsQuitting) {
      event.preventDefault();
      statusWindow.hide();
    }
  });

  statusWindow.on('closed', () => {
    statusWindow = null;
  });

  void statusWindow.loadFile(statusHtmlPath());
}

function buildTrayMenu() {
  const statusLabel =
    lastStatus.state === 'connected'
      ? `Status: USB Connected & Ready${lastStatus.drives.length ? ` (${lastStatus.drives.join(', ')})` : ''}`
      : lastStatus.state === 'nousb'
        ? 'Status: USB Not Plugged In'
        : lastStatus.state === 'needinstall'
          ? 'Status: Need install'
          : 'Status: USB Not Connected';

  return Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show status window',
      click: () => {
        createStatusWindow();
      }
    },
    {
      label: 'Open onlinemall.website',
      click: () => {
        shell.openExternal('https://onlinemall.website');
      }
    },
    {
      label: 'Check bridge health',
      click: async () => {
        try {
          const res = await fetch(HEALTH_URL);
          const body = await res.json();
          dialog.showMessageBox({
            type: 'info',
            title: 'Record Vault USB Bridge',
            message: res.ok ? 'Bridge is healthy' : 'Bridge health check failed',
            detail: JSON.stringify(body, null, 2)
          });
        } catch (err) {
          dialog.showMessageBox({
            type: 'error',
            title: 'Record Vault USB Bridge',
            message: 'Bridge is not reachable',
            detail: String(err?.message || err)
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
  setTrayTooltip();
}

async function startBridge() {
  const root = bridgeRootDir();
  const entry = path.join(root, 'recordVaultBridge', 'index.js');
  if (!fs.existsSync(entry)) {
    bridgeError = `Bridge entry not found: ${entry}`;
    pushStatusToWindow({
      state: 'needinstall',
      title: 'Need install',
      message: bridgeError,
      detail: `Listening on 127.0.0.1:${BRIDGE_PORT}`,
      drives: []
    });
    dialog.showErrorBox('Record Vault USB Bridge', bridgeError);
    return;
  }

  const vendorModules = path.join(root, 'node_modules');
  if (!fs.existsSync(path.join(vendorModules, 'express'))) {
    bridgeError =
      `Runtime dependencies missing (express) under ${vendorModules}. ` +
      'Reinstall from a freshly built DMG that includes be/node_modules.';
    pushStatusToWindow({
      state: 'needinstall',
      title: 'Need install',
      message: bridgeError,
      detail: `Listening on 127.0.0.1:${BRIDGE_PORT}`,
      drives: []
    });
    dialog.showErrorBox('Record Vault USB Bridge failed to start', bridgeError);
    return;
  }

  try {
    await import(pathToFileURL(entry).href);
    bridgeStarted = true;
    bridgeError = '';
  } catch (err) {
    bridgeError = String(err?.message || err);
    pushStatusToWindow({
      state: 'needinstall',
      title: 'Need install',
      message: bridgeError,
      detail: `Listening on 127.0.0.1:${BRIDGE_PORT}`,
      drives: []
    });
    dialog.showErrorBox('Record Vault USB Bridge failed to start', bridgeError);
  }
  await refreshBridgeStatus();
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 18, height: 18 }));
  refreshTrayMenu();
  tray.on('click', () => {
    createStatusWindow();
  });
  tray.on('right-click', () => {
    tray.popUpContextMenu();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createStatusWindow();
  });

  app.whenReady().then(async () => {
    if (process.platform === 'darwin' && app.dock) {
      // Keep a Dock presence so the status window is easy to find.
      app.dock.show();
    }
    createTray();
    createStatusWindow();
    startStatusPolling();
    await startBridge();
    try {
      if (app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: false
        });
      }
    } catch {
      // ignore (permissions / unsupported)
    }
  });

  app.on('activate', () => {
    createStatusWindow();
  });

  app.on('before-quit', () => {
    appIsQuitting = true;
    stopStatusPolling();
  });
}
