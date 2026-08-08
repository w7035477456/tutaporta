import fs from 'fs';
import path from 'path';
import os from 'os';
import { appLog } from '../logger.js';

const DEFAULT_STAGING_SUBDIR = 'recordvault-onedrive';

let cachedEffectiveRoot = null;
let loggedFallback = false;

function expandConfiguredStagingRoot(raw) {
  const configured = String(raw || '').trim();
  if (!configured) return '';
  return configured.startsWith('~/') ? path.join(os.homedir(), configured.slice(2)) : configured;
}

function isClusterMultiServerMode() {
  return String(process.env.CLUSTER_MULTI_SERVER || '').trim().toLowerCase() === 'true';
}

/** True when the configured root exists or can be created writable on this host. */
export function isOneDriveStagingRootUsable(rootPath) {
  const root = path.resolve(String(rootPath || '').trim());
  if (!root) return false;
  try {
    if (fs.existsSync(root)) {
      fs.accessSync(root, fs.constants.W_OK);
      return true;
    }
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultStagingRoot() {
  return path.join(os.tmpdir(), DEFAULT_STAGING_SUBDIR);
}

/**
 * Effective OneDrive staging root for this process/host.
 * Uses RECORD_NOTES_ONEDRIVE_STAGING_ROOT when usable; otherwise per-host tmpdir (Mac dev safe).
 */
export function resolveOneDriveStagingRoot() {
  if (cachedEffectiveRoot) return cachedEffectiveRoot;

  const configuredRaw = process.env.RECORD_NOTES_ONEDRIVE_STAGING_ROOT;
  const configured = expandConfiguredStagingRoot(configuredRaw);
  const fallback = defaultStagingRoot();

  if (configured && isOneDriveStagingRootUsable(configured)) {
    cachedEffectiveRoot = configured;
    return configured;
  }

  if (configured) {
    const msg = `RECORD_NOTES_ONEDRIVE_STAGING_ROOT not usable on this host (${configured}) — using ${fallback}`;
    if (isClusterMultiServerMode()) {
      appLog.error(`[record-vault] ${msg}`);
    } else if (!loggedFallback) {
      appLog.warn(`[record-vault] ${msg}`);
      loggedFallback = true;
    }
  }

  if (!isOneDriveStagingRootUsable(fallback)) {
    fs.mkdirSync(fallback, { recursive: true });
  }
  cachedEffectiveRoot = fallback;
  return fallback;
}

export function oneDriveStagingMountPath(singlesId) {
  return path.join(resolveOneDriveStagingRoot(), String(singlesId));
}

/** Startup diagnostics — configured env value vs path actually in use. */
export function getOneDriveStagingRootStatus() {
  const configured = expandConfiguredStagingRoot(process.env.RECORD_NOTES_ONEDRIVE_STAGING_ROOT);
  const effective = resolveOneDriveStagingRoot();
  return {
    configured: configured || null,
    effective,
    usingFallback: Boolean(configured && path.resolve(configured) !== path.resolve(effective)),
    clusterMode: isClusterMultiServerMode()
  };
}
