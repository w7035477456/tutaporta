/**
 * Backup zips carry the member's vault index (exported from Postgres) as one JSON file at the
 * zip root, next to the vault folder. Sealed with the vault key when the vault is encrypted.
 * Restore / merge read it back into Postgres; it is never copied into the live vault folder.
 */
import fs from 'fs';
import path from 'path';
import { listEnvVaultUnlockKeys } from './vaultKeys.js';

export const TUTANOTES_INDEX_BACKUP_FILE = 'TutaNotesIndex.json';
export const TUTAPHOTOALBUMS_INDEX_BACKUP_FILE = 'TutaPhotoAlbumsIndex.json';

/** @returns {{ name: string, buffer: Buffer }} zip entry for the index */
export function buildVaultIndexBackupEntry(index, key, baseName, sealVaultBuffer) {
  const plain = Buffer.from(JSON.stringify(index));
  const sealed = sealVaultBuffer(plain, key);
  const encrypted = !sealed.equals(plain);
  return { name: encrypted ? `${baseName}.enc` : baseName, buffer: sealed };
}

export function isVaultIndexBackupFileName(name, baseName) {
  const base = path.basename(String(name || ''));
  return base === baseName || base === `${baseName}.enc`;
}

/** First index file found in `dirs` (sealed copy preferred), or null. */
export function findVaultIndexBackupFile(dirs, baseName) {
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of [`${baseName}.enc`, baseName]) {
      const abs = path.join(dir, name);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
    }
  }
  return null;
}

/** Keys that may open a backup's index: the server key for the backup's vault.meta.json, then plaintext. */
export async function listVaultIndexBackupKeys(backupMeta) {
  const keys = [];
  if (backupMeta) {
    try {
      for (const { key } of await listEnvVaultUnlockKeys('tutaCloud', backupMeta)) keys.push(key);
    } catch {
      // no server key configured / meta without kdf salt — plaintext only
    }
  }
  keys.push(null);
  return keys;
}

/**
 * Read + parse an index file, trying each key (null = plaintext).
 * Returns the index and the key that opened it (that key also opens the backup's media).
 * Throws when no key opens it or the JSON is not an index.
 */
export function readVaultIndexBackupFile(absPath, keys, openVaultBuffer, isIndex) {
  const raw = fs.readFileSync(absPath);
  let lastErr = null;
  for (const key of keys) {
    try {
      const index = JSON.parse(openVaultBuffer(raw, key).toString('utf8'));
      if (isIndex(index)) return { index, key };
      lastErr = new Error('Backup index file has an unknown format');
    } catch (err) {
      lastErr = err;
    }
  }
  const err = new Error('Unable to read the backup index (wrong server key or corrupt backup)');
  err.cause = lastErr || undefined;
  throw err;
}
