/**
 * Reloadable config: DB, JWT paths, PORT, Redis.
 * Startup loads ~/.ssh/be/.env and fe/.env once and stores each file byte length in memory.
 * Every 10 seconds checks file lengths; reloads only files whose byte length changed.
 * Use getDBConfig(), getJWTConfig(), getRedisConfig() for current values.
 *
 * Record Vault USB bridge (RECORD_VAULT_BRIDGE_STANDALONE=1) skips DB/JWT requirements.
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isRecordVaultBridgeStandalone } from '../recordVaultBridge/standaloneMode.js';
import { loadHomeEnvExpanded } from '../utils/expandHomeEnv.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const homeEnvPath = path.join(os.homedir(), '.ssh', 'be', '.env');
const feEnvPath = path.join(__dir, '..', 'fe', '.env');

const REFRESH_MS = 10 * 1000;
const STANDALONE = isRecordVaultBridgeStandalone();

let cache = null;
let homeEnvBytes = null;
let feEnvBytes = null;

function getFileByteLength(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return Number.isFinite(stats.size) ? stats.size : -1;
  } catch {
    return -1;
  }
}

function warnDuplicateAwsEnvKeys(filePath) {
  if (!fs.existsSync(filePath)) return;
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']) {
    const matches = raw.match(new RegExp(`^\\s*${key}\\s*=`, 'gm'));
    if (matches && matches.length > 1) {
      console.warn(
        `[envConfig] WARNING: ${key} is set ${matches.length} times in ${filePath}. ` +
          'dotenv uses the LAST value — duplicate AWS keys often cause Rekognition SignatureDoesNotMatch on Linux servers.'
      );
    }
  }
  const secret = String(process.env.AWS_SECRET_ACCESS_KEY ?? '').trim();
  if (secret && secret.length < 40) {
    console.warn(
      '[envConfig] WARNING: AWS_SECRET_ACCESS_KEY looks too short (expected 40 characters). Check for a truncated duplicate line in ~/.ssh/be/.env.'
    );
  }
}

function reloadHomeEnvFile() {
  if (!fs.existsSync(homeEnvPath)) return;
  const homeResult = loadHomeEnvExpanded(homeEnvPath, { override: true });
  if (homeResult.error) {
    console.error('[envConfig] ~/.ssh/be/.env:', homeResult.error.message);
  }
  warnDuplicateAwsEnvKeys(homeEnvPath);
}

function reloadFeEnvFile() {
  if (!fs.existsSync(feEnvPath)) return;
  try {
    const feRaw = fs.readFileSync(feEnvPath, 'utf8');
    const feParsed = dotenv.parse(feRaw);
    if (feParsed.API_PORT != null && String(feParsed.API_PORT).trim() !== '') {
      const p = parseInt(String(feParsed.API_PORT).trim(), 10);
      if (Number.isFinite(p) && p >= 1 && p <= 65535) {
        process.env.PORT = String(p);
        process.env.API_PORT = String(p);
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
    console.error('[envConfig] fe/.env:', e.message);
  }
}

function initializeEnvFiles() {
  homeEnvBytes = getFileByteLength(homeEnvPath);
  feEnvBytes = getFileByteLength(feEnvPath);
  reloadHomeEnvFile();
  reloadFeEnvFile();
}

function reloadChangedEnvFiles() {
  const nextHomeBytes = getFileByteLength(homeEnvPath);
  const nextFeBytes = getFileByteLength(feEnvPath);

  if (nextHomeBytes !== homeEnvBytes) {
    homeEnvBytes = nextHomeBytes;
    reloadHomeEnvFile();
  }
  if (nextFeBytes !== feEnvBytes) {
    feEnvBytes = nextFeBytes;
    reloadFeEnvFile();
  }
}

function readStandaloneConfig() {
  return {
    db: {
      host: '127.0.0.1',
      port: 0,
      database: '',
      user: '',
      password: '',
      schema: 'helloworldjunktest'
    },
    jwt: {
      privateKeyPath: '',
      publicKeyPath: ''
    },
    port: Number.parseInt(process.env.PORT, 10) || 40000,
    redis: {
      url: '',
      host: '',
      port: 6379
    }
  };
}

function readConfig() {
  if (STANDALONE) {
    return readStandaloneConfig();
  }

  if (cache == null) {
    initializeEnvFiles();
  } else {
    reloadChangedEnvFiles();
  }

  const rawSchema = process.env.DB_SCHEMA;
  const schema = (rawSchema && rawSchema.trim()) ? rawSchema.trim().toLowerCase() : '';
  if (!schema) {
    console.error('Error: DB_SCHEMA is not set in ~/.ssh/be/.env');
    process.exit(1);
  }
  if (schema === 'public') {
    console.error('Error: DB_SCHEMA must not be "public". Use a non-public schema (e.g. helloworldjunktest).');
    process.exit(1);
  }

  // const defaultPrivateKeyPath = path.join(os.homedir(), '.ssh', 'be', 'private_key.pem');
  // const defaultPublicKeyPath = path.join(os.homedir(), '.ssh', 'be', 'public_key.pem');

  //if JWT_PRIVATE_KEY_PATH or JWT_PUBLIC_KEY_PATH is not set log error and exit  
  if (!process.env.JWT_PRIVATE_KEY_PATH || !process.env.JWT_PUBLIC_KEY_PATH) {
    console.error('Error: JWT_PRIVATE_KEY_PATH or JWT_PUBLIC_KEY_PATH is not set');
    process.exit(1);
  }

  return {
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 50010,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD != null && process.env.DB_PASSWORD !== '' ? String(process.env.DB_PASSWORD) : '',
      schema: rawSchema.trim()
    },
    jwt: {
      //privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH || defaultPrivateKeyPath,
      //publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || defaultPublicKeyPath
      privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
      publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH
    },
    port: Number.parseInt(process.env.PORT, 10) || 40000,
    redis: {
      url: process.env.REDIS_URL && String(process.env.REDIS_URL).trim(),
      host: process.env.REDIS_HOST && String(process.env.REDIS_HOST).trim(),
      port: parseInt(process.env.REDIS_PORT, 10) || 6379
    }
  };
}

function refresh() {
  cache = readConfig();
}

// Initial load
refresh();

if (!STANDALONE) {
  // Refresh every 10 seconds
  setInterval(refresh, REFRESH_MS);
  console.log('[envConfig] Config refresh every', REFRESH_MS / 1000, 'seconds');
}

export function getDBConfig() {
  return cache.db;
}

export function getJWTConfig() {
  return cache.jwt;
}

export function getPort() {
  return cache.port;
}

export function getRedisConfig() {
  return cache.redis;
}

export function getDBSchema() {
  return cache.db.schema;
}
