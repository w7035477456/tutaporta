/**
 * TutaNotes / TutaPhotoAlbums vault at-rest key: TEMPKEY_TUTADRIVE → Argon2id (salt in
 * vault.meta.json) → 32-byte AES-256-GCM key. Vaults without meta.kdf use legacy SHA-256.
 */
import crypto from 'crypto';
import argon2 from 'argon2';

/** Match account-password Argon2id tune (~0.5–1s). */
export const VAULT_KDF = {
  type: 'argon2id',
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16
};

export const VAULT_KDF_ARGON2ID = 'argon2id';
export const VAULT_KDF_SHA256 = 'sha256';

export function vaultMetaUsesArgon2idKdf(meta) {
  return String(meta?.kdf || '').trim().toLowerCase() === VAULT_KDF_ARGON2ID;
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

/** Legacy: instant SHA-256 of the secret (vaults created before Argon2id). */
export function deriveVaultKeyFromSecretSha256(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

/** Argon2id raw 32-byte key. `salt` is Buffer or base64 string. */
export async function deriveVaultKeyFromSecretArgon2id(secret, salt, options = {}) {
  const saltBuf = Buffer.isBuffer(salt) ? salt : parseVaultKdfSalt(salt);
  if (!saltBuf) {
    throw new Error('Vault Argon2id salt is required');
  }
  const raw = await argon2.hash(String(secret), {
    type: argon2.argon2id,
    salt: saltBuf,
    raw: true,
    hashLength: VAULT_KDF.hashLength,
    memoryCost: Number(options.memoryCost) || VAULT_KDF.memoryCost,
    timeCost: Number(options.timeCost) || VAULT_KDF.timeCost,
    parallelism: Number(options.parallelism) || VAULT_KDF.parallelism
  });
  return Buffer.from(raw);
}

/**
 * At-rest secret for live TutaCloud vault files under LARGE_CHEAP_STORAGE_FOLDER.
 * `storageType` is ignored — kept so callers need not change.
 */
export function getVaultEnvSecret(_storageType) {
  const secret = String(process.env.TEMPKEY_TUTADRIVE ?? '').trim();
  if (!secret) {
    throw new Error('TEMPKEY_TUTADRIVE is not configured');
  }
  return secret;
}

/** New vault: random salt + Argon2id key + meta fields to persist. */
export async function createEnvVaultKeyMaterial(storageType) {
  const salt = crypto.randomBytes(VAULT_KDF.saltLength);
  const key = await deriveVaultKeyFromSecretArgon2id(getVaultEnvSecret(storageType), salt);
  return {
    key,
    kdf: VAULT_KDF_ARGON2ID,
    kdfSalt: salt.toString('base64'),
    kdfMemory: VAULT_KDF.memoryCost,
    kdfIterations: VAULT_KDF.timeCost,
    kdfParallelism: VAULT_KDF.parallelism
  };
}

/** Keys to try for unlock given vault.meta.json (Argon2id when salt present, else legacy SHA-256). */
export async function listEnvVaultUnlockKeys(storageType, meta) {
  const secret = getVaultEnvSecret(storageType);
  if (vaultMetaUsesArgon2idKdf(meta)) {
    const salt = parseVaultKdfSalt(meta.kdfSalt);
    if (!salt) {
      throw new Error('Vault meta is missing Argon2id kdfSalt');
    }
    const key = await deriveVaultKeyFromSecretArgon2id(secret, salt, {
      memoryCost: meta.kdfMemory,
      timeCost: meta.kdfIterations,
      parallelism: meta.kdfParallelism
    });
    return [{ key, kdf: VAULT_KDF_ARGON2ID }];
  }
  return [{ key: deriveVaultKeyFromSecretSha256(secret), kdf: VAULT_KDF_SHA256 }];
}

export function vaultKdfMetaFields(material) {
  if (!material?.kdfSalt) return {};
  return {
    kdf: material.kdf || VAULT_KDF_ARGON2ID,
    kdfSalt: material.kdfSalt,
    kdfMemory: material.kdfMemory ?? VAULT_KDF.memoryCost,
    kdfIterations: material.kdfIterations ?? VAULT_KDF.timeCost,
    kdfParallelism: material.kdfParallelism ?? VAULT_KDF.parallelism
  };
}
