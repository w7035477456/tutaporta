/**
 * Icon-vault key derivation: Argon2id (slow) → 32-byte AES-256-GCM key.
 * Legacy vaults without meta.kdf use SHA-256 (instant) and migrate on unlock.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import argon2 from 'argon2';
import pool from '../db/connection.js';
import { decryptPhotoAlbumsIconKeyMap } from './photoAlbumsIconKeysCrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_LIST_PATH = path.resolve(__dirname, '../../fe/src/constants/fontAwesome5ObjectsIcons.json');

let cachedMap = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Match account-password Argon2id tune (~0.5–1s). */
export const ICON_VAULT_KDF = {
  type: 'argon2id',
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16
};

export const ICON_VAULT_KDF_ARGON2ID = 'argon2id';
export const ICON_VAULT_KDF_SHA256 = 'sha256';

export function normalizePhotoAlbumsIconName(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
}

export function formatPhotoAlbumsIconLabel(iconName) {
  const name = normalizePhotoAlbumsIconName(iconName);
  if (!name) return '';
  return name
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export function listPhotoAlbumsIconCatalog() {
  const raw = fs.readFileSync(ICON_LIST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const icons = Array.isArray(parsed?.icons) ? parsed.icons : [];
  return [...new Set(icons.map((name) => normalizePhotoAlbumsIconName(name)).filter(Boolean))]
    .sort()
    .map((name) => ({ name, label: formatPhotoAlbumsIconLabel(name) }));
}

async function loadIconKeyMap(force = false) {
  const now = Date.now();
  if (!force && cachedMap && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedMap;
  }
  const result = await pool.query(
    `SELECT record_vault_icon_keys_enc
     FROM helloworldjunktest.global
     WHERE id = 1
     LIMIT 1`
  );
  const encBlob = result.rows[0]?.record_vault_icon_keys_enc;
  const map = encBlob ? decryptPhotoAlbumsIconKeyMap(encBlob) : {};
  cachedMap = map;
  cacheLoadedAt = now;
  return map;
}

export async function getPhotoAlbumsIconSecret(iconName) {
  const normalized = normalizePhotoAlbumsIconName(iconName);
  if (!normalized) {
    throw new Error('Security icon is required');
  }
  const map = await loadIconKeyMap();
  const secret = String(map[normalized] ?? '').trim();
  if (!secret) {
    throw new Error('Unknown security icon');
  }
  return secret;
}

export function vaultMetaUsesArgon2idKdf(meta) {
  return String(meta?.kdf || '').trim().toLowerCase() === ICON_VAULT_KDF_ARGON2ID;
}

export function parseVaultKdfSalt(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const buf = Buffer.from(s, 'base64');
    return buf.length >= 8 ? buf : null;
  } catch {
    return null;
  }
}

/** Legacy: instant SHA-256 of icon secret (pre-Argon2id vaults). */
export function deriveVaultKeyFromIconSecretSha256(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

/**
 * Argon2id raw 32-byte key. `salt` is Buffer or base64 string.
 */
export async function deriveVaultKeyFromIconSecretArgon2id(secret, salt, options = {}) {
  const saltBuf = Buffer.isBuffer(salt) ? salt : parseVaultKdfSalt(salt);
  if (!saltBuf) {
    throw new Error('Icon vault Argon2id salt is required');
  }
  const memoryCost = Number(options.memoryCost) || ICON_VAULT_KDF.memoryCost;
  const timeCost = Number(options.timeCost) || ICON_VAULT_KDF.timeCost;
  const parallelism = Number(options.parallelism) || ICON_VAULT_KDF.parallelism;
  const raw = await argon2.hash(String(secret), {
    type: argon2.argon2id,
    salt: saltBuf,
    raw: true,
    hashLength: ICON_VAULT_KDF.hashLength,
    memoryCost,
    timeCost,
    parallelism
  });
  return Buffer.from(raw);
}

/**
 * Derive AES key from icon secret.
 * options.kdf: 'argon2id' (default) | 'sha256'
 * options.salt required for argon2id
 */
export async function deriveVaultKeyFromIconSecret(secret, options = {}) {
  const kdf = String(options.kdf || ICON_VAULT_KDF_ARGON2ID).trim().toLowerCase();
  if (kdf === ICON_VAULT_KDF_SHA256) {
    return deriveVaultKeyFromIconSecretSha256(secret);
  }
  return deriveVaultKeyFromIconSecretArgon2id(secret, options.salt, options);
}

export function getPhotoAlbumsEnvSecret(storageType) {
  const normalizedType = String(storageType || '').trim().toLowerCase();
  // TutaDrive reuses OneDrive env key slot (or TEMPKEY_TUTADRIVE when set).
  let envName = '';
  if (normalizedType === 'onedrive' || normalizedType === 'tutadrive') {
    const tuta = String(process.env.TEMPKEY_TUTADRIVE ?? '').trim();
    envName = tuta ? 'TEMPKEY_TUTADRIVE' : 'TEMPKEY_ONEDRIVE';
  } else if (normalizedType === 'usb') {
    envName = 'TEMPKEY_USB';
  }
  if (!envName) {
    throw new Error('Photo Albums storage type must be onedrive, tutadrive, or usb');
  }
  const secret = String(process.env[envName] ?? '').trim();
  if (!secret) {
    throw new Error(`${envName} is not configured`);
  }
  return secret;
}

export async function getPhotoAlbumsIconEncryptionKey(iconName, options = {}) {
  const secret = await getPhotoAlbumsIconSecret(iconName);
  return deriveVaultKeyFromIconSecret(secret, options);
}

export async function getPhotoAlbumsEnvEncryptionKey(storageType, options = {}) {
  return deriveVaultKeyFromIconSecret(getPhotoAlbumsEnvSecret(storageType), options);
}

/** New vault: random salt + Argon2id key + meta fields to persist. */
export async function createIconVaultKeyMaterial(iconName) {
  const salt = crypto.randomBytes(ICON_VAULT_KDF.saltLength);
  const key = await getPhotoAlbumsIconEncryptionKey(iconName, {
    kdf: ICON_VAULT_KDF_ARGON2ID,
    salt
  });
  return {
    key,
    kdf: ICON_VAULT_KDF_ARGON2ID,
    kdfSalt: salt.toString('base64'),
    kdfMemory: ICON_VAULT_KDF.memoryCost,
    kdfIterations: ICON_VAULT_KDF.timeCost,
    kdfParallelism: ICON_VAULT_KDF.parallelism
  };
}

export async function createEnvVaultKeyMaterial(storageType) {
  const salt = crypto.randomBytes(ICON_VAULT_KDF.saltLength);
  const key = await getPhotoAlbumsEnvEncryptionKey(storageType, {
    kdf: ICON_VAULT_KDF_ARGON2ID,
    salt
  });
  return {
    key,
    kdf: ICON_VAULT_KDF_ARGON2ID,
    kdfSalt: salt.toString('base64'),
    kdfMemory: ICON_VAULT_KDF.memoryCost,
    kdfIterations: ICON_VAULT_KDF.timeCost,
    kdfParallelism: ICON_VAULT_KDF.parallelism
  };
}

/** Keys to try for unlock given vault.meta.json (Argon2id when salt present, else legacy SHA-256). */
export async function listIconVaultUnlockKeys(iconName, meta) {
  const secret = await getPhotoAlbumsIconSecret(iconName);
  return listVaultUnlockKeysFromSecret(secret, meta);
}

async function listVaultUnlockKeysFromSecret(secret, meta) {
  if (vaultMetaUsesArgon2idKdf(meta)) {
    const salt = parseVaultKdfSalt(meta.kdfSalt);
    if (!salt) {
      throw new Error('Vault meta is missing Argon2id kdfSalt');
    }
    const key = await deriveVaultKeyFromIconSecretArgon2id(secret, salt, {
      memoryCost: meta.kdfMemory,
      timeCost: meta.kdfIterations,
      parallelism: meta.kdfParallelism
    });
    return [{ key, kdf: ICON_VAULT_KDF_ARGON2ID }];
  }
  return [{ key: deriveVaultKeyFromIconSecretSha256(secret), kdf: ICON_VAULT_KDF_SHA256 }];
}

export async function listEnvVaultUnlockKeys(storageType, meta) {
  return listVaultUnlockKeysFromSecret(getPhotoAlbumsEnvSecret(storageType), meta);
}

export function iconVaultKdfMetaFields(material) {
  if (!material?.kdfSalt) return {};
  return {
    kdf: material.kdf || ICON_VAULT_KDF_ARGON2ID,
    kdfSalt: material.kdfSalt,
    kdfMemory: material.kdfMemory ?? ICON_VAULT_KDF.memoryCost,
    kdfIterations: material.kdfIterations ?? ICON_VAULT_KDF.timeCost,
    kdfParallelism: material.kdfParallelism ?? ICON_VAULT_KDF.parallelism
  };
}

export function invalidatePhotoAlbumsIconKeyCache() {
  cachedMap = null;
  cacheLoadedAt = 0;
}
