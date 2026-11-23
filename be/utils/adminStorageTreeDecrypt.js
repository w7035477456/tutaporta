/**
 * Admin Tools → Tree: open vault `.enc` files with TEMPKEY_TUTADRIVE for preview.
 * Finds the nearest vault.meta.json above the file and tries Argon2id / SHA-256 unlock keys.
 */
import fs from 'fs';
import path from 'path';
import { listEnvVaultUnlockKeys } from './vaultKeys.js';
import { decryptBuffer } from './recordVaultUsb/vaultCrypto.js';

const MAX_DECRYPT_BYTES = 80 * 1024 * 1024;
const TUTADRIVE_ENV_KEY_TYPE = 'tutaCloud';

function isInside(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

/** Walk up from the file looking for vault.meta.json under storageRoot. */
export function findNearestVaultMetaPath(absFilePath, storageRoot) {
  let dir = path.dirname(path.resolve(absFilePath));
  const root = path.resolve(storageRoot);
  while (isInside(root, dir)) {
    const candidate = path.join(dir, 'vault.meta.json');
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // try parent
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readMetaJson(metaPath) {
  let raw = fs.readFileSync(metaPath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

/**
 * Decrypt a vault `.enc` file for admin preview.
 * @returns {Promise<Buffer|null>} plaintext, or null if not decryptable
 */
export async function decryptAdminVaultEncFile(absFilePath, storageRoot) {
  const abs = path.resolve(absFilePath);
  if (!String(abs).endsWith('.enc')) return null;

  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size < 29 || stat.size > MAX_DECRYPT_BYTES) return null;

  const metaPath = findNearestVaultMetaPath(abs, storageRoot);
  if (!metaPath) return null;

  let meta;
  try {
    meta = readMetaJson(metaPath);
  } catch {
    return null;
  }

  let keys;
  try {
    keys = await listEnvVaultUnlockKeys(TUTADRIVE_ENV_KEY_TYPE, meta);
  } catch (err) {
    console.warn('[adminStorageTreeDecrypt] key derive failed', err?.message || err);
    return null;
  }
  if (!keys?.length) return null;

  let sealed;
  try {
    sealed = fs.readFileSync(abs);
  } catch {
    return null;
  }

  for (const entry of keys) {
    try {
      const opened = decryptBuffer(sealed, entry.key);
      if (opened?.length) return opened;
    } catch {
      // wrong key / corrupt — try next
    }
  }
  return null;
}
