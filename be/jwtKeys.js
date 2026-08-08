import fs from 'fs';
import { getJWTConfig } from './config/envConfig.js';
import { isRecordVaultBridgeStandalone } from './recordVaultBridge/standaloneMode.js';

const REFRESH_MS = 60 * 1000;
const STANDALONE = isRecordVaultBridgeStandalone();

function readKeyOrNull(filePath) {
  try {
    if (!filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf8');
    return data && String(data).trim().length > 0 ? data : null;
  } catch (err) {
    console.error('[jwtKeys] Failed to read key file:', filePath, '-', err.message);
    return null;
  }
}

function loadKeys() {
  const { privateKeyPath, publicKeyPath } = getJWTConfig();
  return {
    privateKey: readKeyOrNull(privateKeyPath),
    publicKey: readKeyOrNull(publicKeyPath),
    privateKeyPath,
    publicKeyPath
  };
}

let cache = STANDALONE
  ? { privateKey: null, publicKey: null, privateKeyPath: '', publicKeyPath: '' }
  : loadKeys();

if (!STANDALONE && (!cache.privateKey || !cache.publicKey)) {
  console.error('[jwtKeys] JWT Key pair missing');
  console.error('[jwtKeys] Expected files:', {
    privateKeyPath: cache.privateKeyPath,
    publicKeyPath: cache.publicKeyPath
  });
  console.error('[jwtKeys] Ensure you have generated an RSA key pair and that PM2 user can read them.');
  process.exit(1);
}

if (!STANDALONE) {
  // Refresh keys every minute (paths and file content)
  setInterval(() => {
    const next = loadKeys();
    if (next.privateKey && next.publicKey) {
      cache = next;
    }
  }, REFRESH_MS);
}

export function getPrivateKey() {
  return cache.privateKey;
}

export function getPublicKey() {
  return cache.publicKey;
}
