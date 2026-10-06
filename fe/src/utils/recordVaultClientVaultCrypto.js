/**
 * Client-only E2E vault crypto (KEK/DEK).
 * Server never sees the password, KEK, or plaintext DEK — only wrapped_dek + ciphertext.
 */
import { argon2id } from 'hash-wasm';

export const VAULT_E2E_CRYPTO_VERSION = 1;

/** Argon2id params (must match server-stored defaults / create payload). */
export const VAULT_E2E_KDF = {
  type: 'argon2id',
  iterations: 3,
  memorySize: 65536,
  parallelism: 1,
  hashLength: 32
};

const IV_LEN = 12;
const TAG_LEN = 16;
const DEK_LEN = 32;

function bytesToBase64(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(String(b64 || ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function randomBytes(length) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function importAesKey(rawBytes, extractable = false) {
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

/**
 * Derive KEK from Encrypt Password + salt (never leave the browser).
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKekFromPassword(password, saltB64, kdf = VAULT_E2E_KDF) {
  const salt = base64ToBytes(saltB64);
  if (!salt.length) throw new Error('Missing KDF salt');
  const pwd = String(password ?? '');
  if (!pwd) throw new Error('Encrypt Password is required');
  const keyBytes = await argon2id({
    password: pwd,
    salt,
    iterations: Number(kdf.iterations) || VAULT_E2E_KDF.iterations,
    memorySize: Number(kdf.memorySize) || VAULT_E2E_KDF.memorySize,
    hashLength: Number(kdf.hashLength) || VAULT_E2E_KDF.hashLength,
    parallelism: Number(kdf.parallelism) || VAULT_E2E_KDF.parallelism,
    outputType: 'binary'
  });
  return importAesKey(keyBytes, false);
}

/** AES-GCM seal → base64(iv|ciphertext+tag). WebCrypto appends tag to ciphertext. */
async function aesGcmEncryptBytes(plainBytes, key) {
  const iv = randomBytes(IV_LEN);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 },
    key,
    plainBytes
  );
  const cipher = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(IV_LEN + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, IV_LEN);
  return bytesToBase64(combined);
}

async function aesGcmDecryptBytes(payloadB64, key) {
  const combined = base64ToBytes(payloadB64);
  // Empty plaintext is valid (IV + tag only) — notebook force-lock encrypts empty notes.
  if (combined.length < IV_LEN + TAG_LEN) {
    throw new Error('Encrypted vault data is corrupt');
  }
  const iv = combined.subarray(0, IV_LEN);
  const data = combined.subarray(IV_LEN);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 },
    key,
    data
  );
  return new Uint8Array(plainBuf);
}

export async function encryptUtf8WithKey(plainText, key) {
  const encoded = new TextEncoder().encode(String(plainText ?? ''));
  return aesGcmEncryptBytes(encoded, key);
}

export async function decryptUtf8WithKey(payloadB64, key) {
  const plain = await aesGcmDecryptBytes(payloadB64, key);
  return new TextDecoder().decode(plain);
}

export async function encryptBytesWithKey(plainBytes, key) {
  const bytes = plainBytes instanceof Uint8Array ? plainBytes : new Uint8Array(plainBytes);
  return aesGcmEncryptBytes(bytes, key);
}

export async function decryptBytesWithKey(payloadB64, key) {
  return aesGcmDecryptBytes(payloadB64, key);
}

/**
 * TutaDrive member backup magics.
 * TNBAK1 (legacy): sealed with the vault DEK only — opens only where that same vault row lives.
 * TNBAK2: also embeds the KDF salt + wrapped DEK, so the Encrypt Password alone opens it on any server.
 */
export const TUTADRIVE_BACKUP_MAGIC_V1 = new TextEncoder().encode('TNBAK1');
export const TUTADRIVE_BACKUP_MAGIC = new TextEncoder().encode('TNBAK2');
const BACKUP_MAGIC_LEN = TUTADRIVE_BACKUP_MAGIC.length;
const BACKUP_HEADER_LEN_BYTES = 4;
const BACKUP_HEADER_MAX = 64 * 1024;

function startsWithMagic(bytes, magic) {
  if (!bytes || bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

/** True for TNBAK1 or TNBAK2 sealed backup bytes. */
export function isTutaDriveSealedBackupBytes(bytes) {
  return startsWithMagic(bytes, TUTADRIVE_BACKUP_MAGIC) || startsWithMagic(bytes, TUTADRIVE_BACKUP_MAGIC_V1);
}

async function aesGcmDecryptRaw(iv, data, key, additionalData) {
  const params = { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 };
  if (additionalData) params.additionalData = additionalData;
  return new Uint8Array(await crypto.subtle.decrypt(params, key, data));
}

/**
 * Seal a vault zip with the in-tab Encrypt Password DEK (zero-knowledge — password never leaves browser).
 * `vaultKeys` = vault row from /api/recordVault/e2e/keys (kdfSaltB64, wrappedDekB64, kdf params) — the
 * same opaque material the server already stores, embedded so restore works on another server.
 * Output: TNBAK2 | version(1) | headerLen(u32 BE) | header JSON | iv(12) | ciphertext+tag
 * (everything before iv is AES-GCM additional data).
 */
export async function sealTutaDriveBackupZipWithDek(plainZipBytes, dek, vaultKeys) {
  if (!dek) throw new Error('Encrypt Password session required to seal backup');
  if (!vaultKeys?.kdfSaltB64 || !vaultKeys?.wrappedDekB64) {
    throw new Error('Encrypt Password key material missing — reopen TutaNotes Cloud and try again');
  }
  const bytes = plainZipBytes instanceof Uint8Array ? plainZipBytes : new Uint8Array(plainZipBytes);
  const header = new TextEncoder().encode(
    JSON.stringify({
      kdfAlgo: vaultKeys.kdfAlgo || VAULT_E2E_KDF.type,
      kdfSaltB64: String(vaultKeys.kdfSaltB64),
      kdfMemKib: Number(vaultKeys.kdfMemKib) || VAULT_E2E_KDF.memorySize,
      kdfTime: Number(vaultKeys.kdfTime) || VAULT_E2E_KDF.iterations,
      kdfParallelism: Number(vaultKeys.kdfParallelism) || VAULT_E2E_KDF.parallelism,
      wrappedDekB64: String(vaultKeys.wrappedDekB64)
    })
  );
  const prefixLen = BACKUP_MAGIC_LEN + 1 + BACKUP_HEADER_LEN_BYTES + header.length;
  const prefix = new Uint8Array(prefixLen);
  prefix.set(TUTADRIVE_BACKUP_MAGIC, 0);
  prefix[BACKUP_MAGIC_LEN] = VAULT_E2E_CRYPTO_VERSION;
  new DataView(prefix.buffer).setUint32(BACKUP_MAGIC_LEN + 1, header.length, false);
  prefix.set(header, BACKUP_MAGIC_LEN + 1 + BACKUP_HEADER_LEN_BYTES);

  const iv = randomBytes(IV_LEN);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: TAG_LEN * 8, additionalData: prefix },
      dek,
      bytes
    )
  );
  const out = new Uint8Array(prefixLen + IV_LEN + cipher.length);
  out.set(prefix, 0);
  out.set(iv, prefixLen);
  out.set(cipher, prefixLen + IV_LEN);
  return out;
}

const WRONG_PASSWORD_MSG = 'Unable to decrypt backup — wrong Encrypt Password or corrupt file';

/**
 * Unseal a TutaDrive backup → plaintext zip bytes.
 * Tries the in-tab vault DEK first; for TNBAK2, falls back to `password` + the embedded salt/wrapped DEK
 * (backup made on another server, or before an Encrypt Password change).
 */
export async function unsealTutaDriveBackupZipWithDek(sealedBytes, dek, { password } = {}) {
  const bytes = sealedBytes instanceof Uint8Array ? sealedBytes : new Uint8Array(sealedBytes);

  if (startsWithMagic(bytes, TUTADRIVE_BACKUP_MAGIC_V1)) {
    if (!dek) throw new Error('Encrypt Password session required to open backup');
    if (bytes.length < BACKUP_MAGIC_LEN + 1 + IV_LEN + TAG_LEN) {
      throw new Error('Backup file is corrupt or not an Encrypt Password sealed backup');
    }
    const iv = bytes.subarray(BACKUP_MAGIC_LEN + 1, BACKUP_MAGIC_LEN + 1 + IV_LEN);
    const data = bytes.subarray(BACKUP_MAGIC_LEN + 1 + IV_LEN);
    try {
      return await aesGcmDecryptRaw(iv, data, dek);
    } catch {
      throw new Error(
        'Unable to decrypt backup — wrong Encrypt Password, or this older-format backup was made on a ' +
          'different server. Create a new Backup on the original server, then download/upload it again.'
      );
    }
  }

  if (!startsWithMagic(bytes, TUTADRIVE_BACKUP_MAGIC)) {
    throw new Error('Backup file is not sealed with Encrypt Password (missing TNBAK header)');
  }
  const headerLenAt = BACKUP_MAGIC_LEN + 1;
  if (bytes.length < headerLenAt + BACKUP_HEADER_LEN_BYTES) {
    throw new Error('Backup file is corrupt or not an Encrypt Password sealed backup');
  }
  const headerLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(headerLenAt, false);
  const prefixLen = headerLenAt + BACKUP_HEADER_LEN_BYTES + headerLen;
  if (headerLen > BACKUP_HEADER_MAX || bytes.length < prefixLen + IV_LEN + TAG_LEN) {
    throw new Error('Backup file is corrupt or not an Encrypt Password sealed backup');
  }
  const prefix = bytes.subarray(0, prefixLen);
  const iv = bytes.subarray(prefixLen, prefixLen + IV_LEN);
  const data = bytes.subarray(prefixLen + IV_LEN);

  if (dek) {
    try {
      return await aesGcmDecryptRaw(iv, data, dek, prefix);
    } catch {
      // different vault DEK (other server / re-created vault) — try embedded key material below
    }
  }
  if (!password) {
    throw new Error(dek ? WRONG_PASSWORD_MSG : 'Encrypt Password session required to open backup');
  }

  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(headerLenAt + BACKUP_HEADER_LEN_BYTES, prefixLen)));
  } catch {
    throw new Error('Backup file is corrupt or not an Encrypt Password sealed backup');
  }
  try {
    const kek = await deriveKekFromPassword(password, header.kdfSaltB64, {
      iterations: header.kdfTime,
      memorySize: header.kdfMemKib,
      parallelism: header.kdfParallelism,
      hashLength: VAULT_E2E_KDF.hashLength
    });
    const { key: backupDek } = await unwrapDek(header.wrappedDekB64, kek);
    return await aesGcmDecryptRaw(iv, data, backupDek, prefix);
  } catch {
    throw new Error(WRONG_PASSWORD_MSG);
  }
}

/** Generate random DEK (extractable so we can wrap it with KEK). */
export async function generateDek() {
  const raw = randomBytes(DEK_LEN);
  const key = await importAesKey(raw, true);
  return { key, raw };
}

/** Wrap DEK with KEK → wrappedDekB64 for server storage. */
export async function wrapDek(dekRawBytes, kek) {
  return aesGcmEncryptBytes(dekRawBytes, kek);
}

/** Unwrap DEK with KEK; wrong password → AES-GCM failure. */
export async function unwrapDek(wrappedDekB64, kek) {
  try {
    const raw = await aesGcmDecryptBytes(wrappedDekB64, kek);
    if (raw.length !== DEK_LEN) throw new Error('Invalid DEK length');
    const key = await importAesKey(raw, false);
    return { key, raw };
  } catch (err) {
    if (err?.message === 'Invalid DEK length') throw err;
    throw new Error('Incorrect Encrypt Password');
  }
}

/** Encrypt a JSON-serializable object with DEK. */
export async function encryptJsonWithDek(obj, dek) {
  return encryptUtf8WithKey(JSON.stringify(obj ?? {}), dek);
}

/** Decrypt JSON object with DEK. */
export async function decryptJsonWithDek(contentB64, dek) {
  const text = await decryptUtf8WithKey(contentB64, dek);
  return JSON.parse(text);
}

/**
 * First-time vault setup: salt + wrap new DEK.
 * Returns payload ready for POST /api/recordVault/pg (no secrets).
 */
export async function createVaultKeyMaterial(password) {
  const salt = randomBytes(16);
  const saltB64 = bytesToBase64(salt);
  const kek = await deriveKekFromPassword(password, saltB64);
  const { key: dek, raw: dekRaw } = await generateDek();
  const wrappedDekB64 = await wrapDek(dekRaw, kek);
  return {
    dek,
    dekRaw,
    createPayload: {
      kdfAlgo: VAULT_E2E_KDF.type,
      kdfSaltB64: saltB64,
      kdfMemKib: VAULT_E2E_KDF.memorySize,
      kdfTime: VAULT_E2E_KDF.iterations,
      kdfParallelism: VAULT_E2E_KDF.parallelism,
      wrappedDekB64,
      cryptoVersion: VAULT_E2E_CRYPTO_VERSION,
      backends: ['usb', 'onedrive']
    }
  };
}

/** Unlock existing vault row with password → DEK (+ raw for re-wrap) in memory. */
export async function unlockVaultWithPassword(vault, password) {
  if (!vault?.kdfSaltB64 || !vault?.wrappedDekB64) {
    throw new Error('Vault key material missing');
  }
  const kek = await deriveKekFromPassword(password, vault.kdfSaltB64, {
    iterations: vault.kdfTime,
    memorySize: vault.kdfMemKib,
    parallelism: vault.kdfParallelism,
    hashLength: VAULT_E2E_KDF.hashLength
  });
  const { key: dek, raw: dekRaw } = await unwrapDek(vault.wrappedDekB64, kek);
  return { dek, dekRaw };
}

/**
 * Password change: re-wrap same DEK under new password (no data re-encrypt).
 * Requires current DEK already unlocked in memory.
 */
export async function rewrapDekForNewPassword(dekRawBytes, newPassword) {
  const salt = randomBytes(16);
  const saltB64 = bytesToBase64(salt);
  const kek = await deriveKekFromPassword(newPassword, saltB64);
  const wrappedDekB64 = await wrapDek(dekRawBytes, kek);
  return {
    kdfAlgo: VAULT_E2E_KDF.type,
    kdfSaltB64: saltB64,
    kdfMemKib: VAULT_E2E_KDF.memorySize,
    kdfTime: VAULT_E2E_KDF.iterations,
    kdfParallelism: VAULT_E2E_KDF.parallelism,
    wrappedDekB64,
    cryptoVersion: VAULT_E2E_CRYPTO_VERSION
  };
}

export { bytesToBase64, base64ToBytes };
