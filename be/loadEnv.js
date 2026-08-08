/**
 * Load ~/.ssh/be/.env before any other app code so DB_*, PORT, etc. are set
 * regardless of process cwd. Must be imported first in server_be.js.
 * ~ is the user home directory (e.g. /Users/a on Mac, /Users/a on Ubuntu).
 * Only this path is used; be/.env (project-relative) is never read.
 *
 * After that, if fe/.env exists, API_PORT is read and sets process.env.PORT
 * (single source of truth with the Vite frontend).
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadHomeEnvExpanded } from './utils/expandHomeEnv.js';

const homeEnvPath = path.join(os.homedir(), '.ssh', 'be', '.env');
const fileExists = fs.existsSync(homeEnvPath);
const hadDbHostBefore = !!process.env.DB_HOST;

console.log('[loadEnv] Resolved env path (~/.ssh/be/.env):', homeEnvPath);
console.log('[loadEnv] File exists at that path:', fileExists);
if (hadDbHostBefore) {
  console.log('[loadEnv] DB_HOST already set in process environment (before loading file) – env may come from shell/PM2/systemd, not from ~/.ssh/be/.env');
}

// Supports ${STORAGE_FOLDER}, ${ROOT_FOLDER}, etc. in ~/.ssh/be/.env
let result = loadHomeEnvExpanded(homeEnvPath, { override: true });

// `npm run dev` in be/ sets RUN_LOCAL_API_DEV=1 so NODE_ENV from ~/.ssh/be/.env does not force
// production (which requires fe/dist). Use Vite on :3000 + API on PORT without building fe.
if (String(process.env.RUN_LOCAL_API_DEV || '').trim() === '1' || String(process.env.RUN_LOCAL_API_DEV || '').toLowerCase() === 'true') {
  process.env.NODE_ENV = 'development';
  console.log('[loadEnv] RUN_LOCAL_API_DEV: NODE_ENV set to development (API-only dev; build fe/dist only if you serve the UI from Node)');
}

if (result.error) {
  console.error('[loadEnv] Failed to load .env:', result.error.message);
  console.error('[loadEnv] Tried path:', homeEnvPath);
}
if (result.parsed && Object.keys(result.parsed).length > 0) {
  console.log('[loadEnv] Loaded', Object.keys(result.parsed).length, 'vars from file:', homeEnvPath);
  process.env.__ENV_SOURCE = homeEnvPath;
} else if (process.env.DB_HOST) {
  console.log('[loadEnv] DB_* (and other vars) are from process environment, NOT from file ~/.ssh/be/.env');
  process.env.__ENV_SOURCE = 'process environment (not from ~/.ssh/be/.env)';
} else {
  process.env.__ENV_SOURCE = 'none';
}
if (!process.env.DB_HOST) {
  const exists = fs.existsSync(homeEnvPath);
  console.error('[loadEnv] DB_HOST still undefined. File exists?', exists, 'Path:', homeEnvPath);
  console.error('[loadEnv] Create ~/.ssh/be/.env with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (and SMTP_*, SMS provider vars as needed).');
}

// Listen port: fe/.env API_PORT overrides PORT (aligns backend with Vite dev/prod URL)
const __loadEnvDir = path.dirname(fileURLToPath(import.meta.url));
const feEnvPath = path.join(__loadEnvDir, '..', 'fe', '.env');
if (fs.existsSync(feEnvPath)) {
  try {
    const feRaw = fs.readFileSync(feEnvPath, 'utf8');
    const feParsed = dotenv.parse(feRaw);
    if (feParsed.API_PORT != null && String(feParsed.API_PORT).trim() !== '') {
      const p = parseInt(String(feParsed.API_PORT).trim(), 10);
      if (Number.isFinite(p) && p >= 1 && p <= 65535) {
        process.env.PORT = String(p);
        process.env.API_PORT = String(p);
        console.log('[loadEnv] API_PORT from fe/.env → PORT =', p, '(', feEnvPath, ')');
      } else {
        console.error('[loadEnv] Invalid API_PORT in fe/.env (expected 1–65535):', feParsed.API_PORT);
      }
    }
    if (feParsed.VITE_THEME1) {
      const parts = String(feParsed.VITE_THEME1).split(',').map((p) => p.trim());
      if (parts[1] && /^#[0-9A-Fa-f]{6}$/.test(parts[1])) {
        process.env.THEME_PRIMARY_HEX = parts[1];
      }
    }
    if (!process.env.THEME_PRIMARY_HEX) process.env.THEME_PRIMARY_HEX = 'var(--theme-primary-color)';
  } catch (e) {
    console.error('[loadEnv] Could not read fe/.env for API_PORT:', e.message);
  }
} else {
  console.log('[loadEnv] fe/.env not found (skip API_PORT):', feEnvPath);
}

console.log('[loadEnv] Record Vault env:', {
  NOTES_ICON_ENCRYPTION: process.env.NOTES_ICON_ENCRYPTION ?? '(unset)',
  NOTES_ENCRYPT_PHOTO_AND_DB: process.env.NOTES_ENCRYPT_PHOTO_AND_DB ?? '(unset)',
  NOTES_ICON_RETRY_DELAY_SEC: process.env.NOTES_ICON_RETRY_DELAY_SEC ?? '(unset, default 300 seconds)'
});

if (!globalThis.__vsinglesProcessGuardsInstalled) {
  globalThis.__vsinglesProcessGuardsInstalled = true;
  process.on('unhandledRejection', (reason) => {
    const message =
      reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.error('[process] unhandledRejection — kept alive:', message);
    if (reason instanceof Error && reason.stack) {
      console.error(reason.stack);
    }
  });
  process.on('uncaughtException', (err) => {
    console.error('[process] uncaughtException — kept alive:', err?.message || err);
    if (err?.stack) console.error(err.stack);
  });
}

// Start config refresh loop (DB, JWT, Redis, rate limit) every 10 seconds with file-size change detection
import './config/envConfig.js';
