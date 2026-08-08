/**
 * Compare a login + password against helloworldjunktest.singles (same rules as beVerifyLoginPassword.js).
 *
 * Usage (from be/):
 *   node scripts/verify-login-password.js
 *   node scripts/verify-login-password.js "user@example.com" "your-password"
 *   npm run verify-login
 *
 * Env: ~/.ssh/be/.env (DB_*), same as the API.
 *
 * Note: Argon2id/bcrypt use a random salt — a fresh hash will NOT equal the DB hash even when
 * login would succeed. Use password_match, not string equality.
 */
import '../loadEnv.js';
import readline from 'readline';
import pool from '../db/connection.js';
import { normalizeLoginIdentifier } from '../utils/loginIdentifier.js';
import {
  hashPassword,
  looksLikeArgon2id,
  looksLikeBcrypt,
  verifyPassword
} from '../utils/passwordHash.js';

const USER_SELECT = `SELECT singles_id, email, alias, member_id, member_category,
       password_hash, password_attempt_count, password_attempt_datetime
         FROM helloworldjunktest.singles s`;

function storedHashFormat(storedHash) {
  const s = String(storedHash ?? '').trim();
  if (!s) return 'missing';
  if (looksLikeArgon2id(s)) return 'argon2id';
  if (looksLikeBcrypt(s)) return 'bcrypt';
  return 'plain_text';
}

async function findUserByLoginIdentifier(identifier) {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) return { normalized: null, user: null };

  if (normalized.type === 'phone') {
    const phoneResult = await pool.query(
      `${USER_SELECT}
         WHERE s.phone = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
      [normalized.value]
    );
    return { normalized, user: phoneResult.rows[0] ?? null };
  }

  const emailResult = await pool.query(
    `${USER_SELECT}
         WHERE s.email = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
    [normalized.value]
  );
  if (emailResult.rows[0]) {
    return { normalized, user: emailResult.rows[0] };
  }

  if (!normalized.value.includes('@')) {
    const aliasResult = await pool.query(
      `${USER_SELECT}
         WHERE LOWER(TRIM(s.alias)) = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
      [normalized.value]
    );
    if (aliasResult.rows[0]) {
      return { normalized: { ...normalized, type: 'alias' }, user: aliasResult.rows[0] };
    }

    if (/^\d+$/.test(normalized.value)) {
      const memberNum = String(parseInt(normalized.value, 10));
      const memberResult = await pool.query(
        `${USER_SELECT}
         WHERE s.member_id::text = $1
         ORDER BY COALESCE(s.updated_at, s.created_at) DESC
         LIMIT 1`,
        [memberNum]
      );
      if (memberResult.rows[0]) {
        return { normalized: { ...normalized, type: 'member_id' }, user: memberResult.rows[0] };
      }
    }
  }

  return { normalized, user: null };
}

function ask(rl, question, { hidden = false } = {}) {
  if (!hidden) {
    return new Promise((resolve) => rl.question(question, resolve));
  }
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    process.stdout.write(question);
    let value = '';
    const onData = (chunk) => {
      const c = chunk.toString('utf8');
      for (let i = 0; i < c.length; i += 1) {
        const ch = c[i];
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          stdin.off('data', onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function readCredentials() {
  const loginArg = process.argv[2];
  const passwordArg = process.argv[3];
  if (loginArg && passwordArg !== undefined) {
    return { loginId: loginArg.trim(), password: passwordArg };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const loginId = (await ask(rl, 'Login (email, phone, alias, or member#): ')).trim();
    const password = await ask(rl, 'Password: ', { hidden: true });
    return { loginId, password };
  } finally {
    rl.close();
  }
}

async function main() {
  const { loginId, password } = await readCredentials();
  const providedPassword = typeof password === 'string' ? password.trim() : '';

  if (!loginId || !providedPassword) {
    console.error('Error: login and password are required.');
    process.exit(1);
  }

  const { normalized, user } = await findUserByLoginIdentifier(loginId);

  const result = {
    login_input: loginId,
    login_type: normalized?.type ?? null,
    user_found: Boolean(user),
    singles_id: user?.singles_id ?? null,
    email: user?.email ?? null,
    alias: user?.alias ?? null,
    member_id: user?.member_id ?? null,
    password_length_entered: providedPassword.length,
    stored_hash_in_db: user ? String(user.password_hash ?? '') : null,
    stored_hash_format: user ? storedHashFormat(user.password_hash) : null,
    password_match: null,
    fresh_argon2id_hash_of_your_password: null,
    password_attempt_count: user?.password_attempt_count ?? null,
    password_attempt_datetime: user?.password_attempt_datetime ?? null
  };

  if (!normalized) {
    result.error = 'Invalid login identifier format';
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  if (!user) {
    result.error = 'No user found for that login';
    console.log(JSON.stringify(result, null, 2));
    process.exit(3);
  }

  if (!user.password_hash) {
    result.error = 'No password_hash set on this account';
    console.log(JSON.stringify(result, null, 2));
    process.exit(4);
  }

  result.password_match = await verifyPassword(user.password_hash, providedPassword);
  result.fresh_argon2id_hash_of_your_password = await hashPassword(providedPassword);
  result.fresh_hash_note =
    'Salts differ each run — compare with password_match, not string equality to stored_hash_in_db.';
  if (result.stored_hash_format === 'plain_text') {
    result.plain_text_stored_value_matches_entered =
      String(user.password_hash).trim() === providedPassword;
  }

  console.log(JSON.stringify(result, null, 2));
  console.log('');
  console.log(result.password_match ? 'RESULT: MATCH (login password gate would pass)' : 'RESULT: NO MATCH (401 password gate)');

  await pool.end();
  process.exit(result.password_match ? 0 : 5);
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
