/**
 * Hash a password with Argon2id (same as app login / account passwords).
 *
 * Usage:
 *   node scripts/hash-password.js "your-password"
 *
 * Default password: passworda
 */
import { hashPassword, PASSWORD_ARGON2_OPTIONS } from '../utils/passwordHash.js';

const plain = process.argv[2] || 'passworda';
const hash = await hashPassword(plain);
console.log(hash);
console.log(
  `# Argon2id m=${PASSWORD_ARGON2_OPTIONS.memoryCost} t=${PASSWORD_ARGON2_OPTIONS.timeCost} p=${PASSWORD_ARGON2_OPTIONS.parallelism}`
);
