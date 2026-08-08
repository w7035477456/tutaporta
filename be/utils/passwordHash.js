/**
 * Account / tools password hashing — Argon2id (OWASP-style params).
 * Verify still accepts legacy bcrypt ($2a/$2b/$2y) and plaintext for migration.
 */
import argon2 from 'argon2';
import bcrypt from 'bcrypt';

/** ~64 MiB, 3 passes — ~0.5–1s on typical Mac/server hardware. */
export const PASSWORD_ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1
};

export function looksLikeArgon2id(storedHash) {
  return /^\$argon2id\$/.test(String(storedHash ?? '').trim());
}

export function looksLikeBcrypt(storedHash) {
  return /^\$2[aby]\$\d{2}\$/.test(String(storedHash ?? '').trim());
}

/** Hash a new password with Argon2id. */
export async function hashPassword(plain) {
  return argon2.hash(String(plain ?? ''), PASSWORD_ARGON2_OPTIONS);
}

/**
 * Verify plain password against stored hash.
 * Supports Argon2id, bcrypt, and legacy plaintext equality.
 */
export async function verifyPassword(storedHash, plain) {
  const stored = String(storedHash ?? '').trim();
  const password = String(plain ?? '');
  if (!stored || !password) return false;

  if (looksLikeArgon2id(stored)) {
    try {
      return await argon2.verify(stored, password);
    } catch {
      return false;
    }
  }

  if (looksLikeBcrypt(stored)) {
    try {
      return await bcrypt.compare(password, stored);
    } catch {
      return false;
    }
  }

  return password === stored;
}

/** True when stored value should be rewritten to current Argon2id params. */
export function passwordNeedsRehash(storedHash) {
  const stored = String(storedHash ?? '').trim();
  if (!stored) return false;
  if (!looksLikeArgon2id(stored)) return true;
  try {
    return argon2.needsRehash(stored, PASSWORD_ARGON2_OPTIONS);
  } catch {
    return true;
  }
}
