import crypto from 'crypto';
import { isPhotoAlbumsIconEncryptionEnabled } from '../photoAlbumsIconEncryption.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function parseEnvBool(raw, defaultValue = true) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

/**
 * PHOTOALBUMS_ENCRYPT_PHOTO_AND_DB=false => plaintext bytes + plain filenames (vault.db, 1.jpg).
 * When unset: follows PHOTOALBUMS_ICON_ENCRYPTION (default false = plaintext v3 vault).
 */
export function isVaultPhotoAndDbEncryptionEnabled() {
  const raw = process.env.PHOTOALBUMS_ENCRYPT_PHOTO_AND_DB;
  if (raw === undefined || String(raw).trim() === '') {
    return isPhotoAlbumsIconEncryptionEnabled();
  }
  return parseEnvBool(raw, true);
}

export function isPlaintextVaultKey(key) {
  return key == null;
}

export function encryptBuffer(plainBuffer, key) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptBuffer(encBuffer, key) {
  const buf = Buffer.isBuffer(encBuffer) ? encBuffer : Buffer.from(encBuffer);
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Encrypted vault data is corrupt or missing');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** Seal vault payload — plaintext passthrough when key is null (PHOTOALBUMS_ICON_ENCRYPTION=false). */
export function sealVaultBuffer(plainBuffer, key) {
  const plain = Buffer.isBuffer(plainBuffer) ? plainBuffer : Buffer.from(plainBuffer);
  if (!isVaultPhotoAndDbEncryptionEnabled() || isPlaintextVaultKey(key)) return plain;
  return encryptBuffer(plain, key);
}

/** Open vault payload — plaintext passthrough when key is null. */
export function openVaultBuffer(sealedBuffer, key) {
  const sealed = Buffer.isBuffer(sealedBuffer) ? sealedBuffer : Buffer.from(sealedBuffer);
  if (!isVaultPhotoAndDbEncryptionEnabled() || isPlaintextVaultKey(key)) return sealed;
  return decryptBuffer(sealed, key);
}
