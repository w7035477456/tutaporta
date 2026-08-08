/**
 * Rehash a singles (or global tools) password from bcrypt/plaintext → Argon2id.
 *
 * Usage (from be/):
 *   node scripts/migratePasswordToArgon2id.js <email-or-login> <plain-password>
 *   node scripts/migratePasswordToArgon2id.js --global <plain-password>
 *   node scripts/migratePasswordToArgon2id.js --all-matching <email> <plain-password>
 *
 * Env: ~/.ssh/be/.env
 *
 * Normal login also auto-upgrades the hash on success (lazy migration).
 * This script is for upgrading without waiting for a UI login, or fixing global.password_hash.
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { normalizeLoginIdentifier } from '../utils/loginIdentifier.js';
import {
  hashPassword,
  looksLikeArgon2id,
  passwordNeedsRehash,
  verifyPassword
} from '../utils/passwordHash.js';

function schemaName() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

async function findSinglesByLogin(loginId) {
  const normalized = normalizeLoginIdentifier(loginId);
  if (!normalized) return null;

  const select = `SELECT singles_id, email, password_hash FROM "${schemaName()}"."singles" s`;

  if (normalized.type === 'phone') {
    const r = await pool.query(
      `${select} WHERE s.phone = $1 ORDER BY COALESCE(s.updated_at, s.created_at) DESC LIMIT 1`,
      [normalized.value]
    );
    return r.rows[0] ?? null;
  }

  const byEmail = await pool.query(
    `${select} WHERE s.email = $1 ORDER BY COALESCE(s.updated_at, s.created_at) DESC LIMIT 1`,
    [normalized.value]
  );
  if (byEmail.rows[0]) return byEmail.rows[0];

  if (!normalized.value.includes('@')) {
    const byAlias = await pool.query(
      `${select} WHERE LOWER(TRIM(s.alias)) = $1 ORDER BY COALESCE(s.updated_at, s.created_at) DESC LIMIT 1`,
      [normalized.value]
    );
    if (byAlias.rows[0]) return byAlias.rows[0];
  }
  return null;
}

async function upgradeSinglesRow(row, plain) {
  const ok = await verifyPassword(row.password_hash, plain);
  if (!ok) {
    return { ok: false, error: 'password does not match stored hash', singles_id: row.singles_id };
  }
  if (!passwordNeedsRehash(row.password_hash)) {
    return {
      ok: true,
      skipped: true,
      reason: 'already Argon2id with current params',
      singles_id: row.singles_id,
      email: row.email
    };
  }
  const newHash = await hashPassword(plain);
  await pool.query(
    `UPDATE "${schemaName()}"."singles"
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $2`,
    [newHash, row.singles_id]
  );
  return {
    ok: true,
    upgraded: true,
    singles_id: row.singles_id,
    email: row.email,
    was_argon2id: looksLikeArgon2id(row.password_hash),
    new_hash_prefix: newHash.slice(0, 32)
  };
}

async function upgradeGlobal(plain) {
  const table = `"${schemaName()}"."global"`;
  const { rows } = await pool.query(`SELECT password_hash FROM ${table} WHERE id = 1 LIMIT 1`);
  const stored = String(rows[0]?.password_hash ?? '').trim();
  if (!stored) {
    return { ok: false, error: 'global.password_hash is empty' };
  }
  const ok = await verifyPassword(stored, plain);
  if (!ok) {
    return { ok: false, error: 'password does not match global.password_hash' };
  }
  if (!passwordNeedsRehash(stored)) {
    return { ok: true, skipped: true, reason: 'global already Argon2id with current params' };
  }
  const newHash = await hashPassword(plain);
  await pool.query(`UPDATE ${table} SET password_hash = $1 WHERE id = 1`, [newHash]);
  return { ok: true, upgraded: true, target: 'global', new_hash_prefix: newHash.slice(0, 32) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(`Usage:
  node scripts/migratePasswordToArgon2id.js <login> <plain-password>
  node scripts/migratePasswordToArgon2id.js --global <plain-password>`);
    process.exit(1);
  }

  let result;
  if (args[0] === '--global') {
    result = await upgradeGlobal(args[1]);
  } else {
    const row = await findSinglesByLogin(args[0]);
    if (!row) {
      result = { ok: false, error: 'user not found', login: args[0] };
    } else {
      result = await upgradeSinglesRow(row, args[1]);
    }
  }

  console.log(JSON.stringify(result, null, 2));
  await pool.end();
  process.exit(result.ok ? 0 : 2);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
