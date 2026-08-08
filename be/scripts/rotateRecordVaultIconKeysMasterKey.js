#!/usr/bin/env node
/**
 * Interactive rotation of RECORD_NOTES_ICON_KEYS_MASTER_KEY: re-wrap global icon secrets
 * and OneDrive refresh tokens. Icon secrets inside the map are unchanged — users keep
 * the same security icon; vault files on USB/OneDrive are not re-encrypted.
 *
 * Usage (from repo root or be/):
 *   node be/scripts/rotateRecordVaultIconKeysMasterKey.js
 *
 * Dry run (decrypt/verify only, no DB writes):
 *   node be/scripts/rotateRecordVaultIconKeysMasterKey.js --dry-run
 *
 * Non-interactive (optional):
 *   RECORD_NOTES_ICON_KEYS_MASTER_KEY_OLD='...' node be/scripts/rotateRecordVaultIconKeysMasterKey.js
 */
import readline from 'readline';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dryRun = process.argv.includes('--dry-run');

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

function readMasterKeyFromEnvFile() {
  const envPath = path.join(os.homedir(), '.ssh', 'be', '.env');
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^RECORD_NOTES_ICON_KEYS_MASTER_KEY\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return { envPath, value: v, found: true };
    }
    return { envPath, value: '', found: false };
  } catch (err) {
    return { envPath, value: '', found: false, readError: String(err?.message || err) };
  }
}

async function readCurrentMasterKey() {
  const fromEnv = String(process.env.RECORD_NOTES_ICON_KEYS_MASTER_KEY_OLD ?? '').trim();
  if (fromEnv) {
    console.log('[rotateVaultKey] Using RECORD_NOTES_ICON_KEYS_MASTER_KEY_OLD from process env');
    return fromEnv;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      'Current key required: run interactively or set RECORD_NOTES_ICON_KEYS_MASTER_KEY_OLD'
    );
  }

  console.log('Record Vault master key rotation');
  console.log('Paste your current RECORD_NOTES_ICON_KEYS_MASTER_KEY (from ~/.ssh/be/.env).');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const key = String(await ask(rl, 'Current key: ', { hidden: true })).trim();
    if (!key) {
      throw new Error('Current RECORD_NOTES_ICON_KEYS_MASTER_KEY is required');
    }
    return key;
  } finally {
    rl.close();
  }
}

function generateNewMasterKey() {
  return crypto.randomBytes(32).toString('base64url');
}

async function rotateKeys(oldKey, newKey) {
  await import('../loadEnv.js');
  const { fingerprintRecordVaultMasterKeyRaw } = await import('../utils/recordVaultMasterKey.js');
  const { default: pool } = await import('../db/connection.js');
  const {
    decryptRecordVaultIconKeyMap,
    encryptRecordVaultIconKeyMap,
    fingerprintRecordVaultIconKeysEncBlob
  } = await import('../utils/recordVaultIconKeysCrypto.js');
  const { decryptDriveRefreshToken, encryptDriveRefreshToken } = await import(
    '../utils/recordVaultDrive/driveTokenCrypto.js'
  );
  const { invalidateRecordVaultIconKeyCache } = await import('../utils/recordVaultIconKeys.js');

  const envFile = readMasterKeyFromEnvFile();
  const pastedFp = fingerprintRecordVaultMasterKeyRaw(oldKey);
  const envFileFp = envFile.found
    ? fingerprintRecordVaultMasterKeyRaw(envFile.value)
    : null;
  const processEnvKey = String(process.env.RECORD_NOTES_ICON_KEYS_MASTER_KEY ?? '').trim();
  const processEnvFp = processEnvKey
    ? fingerprintRecordVaultMasterKeyRaw(processEnvKey)
    : null;

  console.log('[rotateVaultKey:debug] host / runtime', {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    openssl: process.versions?.openssl ?? '(unknown)',
    cwd: process.cwd(),
    homedir: os.homedir(),
    hostname: os.hostname()
  });
  console.log('[rotateVaultKey:debug] DB target after loadEnv', {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_SCHEMA: process.env.DB_SCHEMA,
    envSource: process.env.__ENV_SOURCE
  });
  console.log('[rotateVaultKey:debug] pasted current-key fingerprint (not the key itself)', pastedFp);
  console.log('[rotateVaultKey:debug] ~/.ssh/be/.env master key', {
    envPath: envFile.envPath,
    found: envFile.found,
    readError: envFile.readError ?? null,
    fingerprint: envFileFp,
    pastedMatchesEnvFile:
      envFile.found && envFileFp
        ? envFileFp.sha256OfRawUtf8Prefix16 === pastedFp.sha256OfRawUtf8Prefix16
        : null
  });
  console.log('[rotateVaultKey:debug] process.env RECORD_NOTES_ICON_KEYS_MASTER_KEY after loadEnv', {
    set: Boolean(processEnvKey),
    fingerprint: processEnvFp,
    pastedMatchesProcessEnv: processEnvFp
      ? processEnvFp.sha256OfRawUtf8Prefix16 === pastedFp.sha256OfRawUtf8Prefix16
      : null,
    envFileMatchesProcessEnv:
      envFileFp && processEnvFp
        ? envFileFp.sha256OfRawUtf8Prefix16 === processEnvFp.sha256OfRawUtf8Prefix16
        : null
  });

  const client = await pool.connect();
  let inTransaction = false;
  try {
    const identity = await client.query(
      `SELECT
         current_database() AS db,
         inet_server_addr()::text AS server_addr,
         inet_server_port() AS server_port,
         pg_is_in_recovery() AS in_recovery,
         version() AS pg_version`
    );
    console.log('[rotateVaultKey:debug] Postgres identity (compare Mac vs Ubuntu)', identity.rows[0]);

    const globalResult = await client.query(
      `SELECT record_vault_icon_keys_enc,
              length(record_vault_icon_keys_enc) AS enc_char_len,
              md5(record_vault_icon_keys_enc) AS enc_md5
       FROM helloworldjunktest.global
       WHERE id = 1
       LIMIT 1`
    );
    const encBlob = String(globalResult.rows[0]?.record_vault_icon_keys_enc ?? '').trim();
    const encBlobFp = fingerprintRecordVaultIconKeysEncBlob(
      globalResult.rows[0]?.record_vault_icon_keys_enc ?? ''
    );
    console.log('[rotateVaultKey:debug] global.record_vault_icon_keys_enc fingerprint', {
      sqlCharLen: globalResult.rows[0]?.enc_char_len ?? null,
      sqlMd5: globalResult.rows[0]?.enc_md5 ?? null,
      ...encBlobFp
    });
    if (!encBlob) {
      throw new Error('record_vault_icon_keys_enc is empty — run seedRecordVaultIconKeys.js first');
    }

    console.log('[rotateVaultKey:debug] Decrypting icon key map with pasted current key...');
    const iconMap = decryptRecordVaultIconKeyMap(encBlob, { masterKeyRaw: oldKey });
    const iconCount = Object.keys(iconMap).length;
    console.log('[rotateVaultKey:debug] Icon map decrypt OK', { iconCount });
    if (iconCount < 1) {
      throw new Error(
        'Could not decrypt icon keys — check that the current key matches what is in ~/.ssh/be/.env'
      );
    }

    const newEncBlob = encryptRecordVaultIconKeyMap(iconMap, { masterKeyRaw: newKey });
    const verifyMap = decryptRecordVaultIconKeyMap(newEncBlob, { masterKeyRaw: newKey });
    if (JSON.stringify(verifyMap) !== JSON.stringify(iconMap)) {
      throw new Error('Post-encrypt verification failed for record_vault_icon_keys_enc');
    }

    const tokenResult = await client.query(
      `SELECT singles_id, record_notes_onedrive_refresh_token_enc
       FROM helloworldjunktest.singles
       WHERE record_notes_onedrive_refresh_token_enc IS NOT NULL
         AND btrim(record_notes_onedrive_refresh_token_enc) <> ''`
    );

    console.log('[rotateVaultKey:debug] OneDrive token rows to re-wrap', {
      count: tokenResult.rows.length
    });

    const tokenRows = tokenResult.rows.map((row) => {
      const enc = String(row.record_notes_onedrive_refresh_token_enc ?? '').trim();
      console.log('[rotateVaultKey:debug] Decrypting OneDrive token', {
        singles_id: row.singles_id,
        encCharLen: enc.length,
        encSha256Prefix16: enc
          ? crypto.createHash('sha256').update(enc, 'utf8').digest('hex').slice(0, 16)
          : '(empty)'
      });
      let refreshToken;
      try {
        refreshToken = decryptDriveRefreshToken(enc, { masterKeyRaw: oldKey });
      } catch (err) {
        throw new Error(
          `OneDrive token decrypt failed for singles_id=${row.singles_id}: ${err?.message || err}`
        );
      }
      if (!refreshToken) {
        throw new Error(`OneDrive token decrypt failed for singles_id=${row.singles_id}`);
      }
      const newEnc = encryptDriveRefreshToken(refreshToken, { masterKeyRaw: newKey });
      const roundTrip = decryptDriveRefreshToken(newEnc, { masterKeyRaw: newKey });
      if (roundTrip !== refreshToken) {
        throw new Error(`OneDrive token verify failed for singles_id=${row.singles_id}`);
      }
      return { singlesId: Number(row.singles_id), newEnc };
    });

    if (dryRun) {
      return { iconCount, tokenCount: tokenRows.length };
    }

    await client.query('BEGIN');
    inTransaction = true;

    await client.query(
      `UPDATE helloworldjunktest.global
       SET record_vault_icon_keys_enc = $1
       WHERE id = 1`,
      [newEncBlob]
    );

    for (const { singlesId, newEnc } of tokenRows) {
      await client.query(
        `UPDATE helloworldjunktest.singles
         SET record_notes_onedrive_refresh_token_enc = $2
         WHERE singles_id = $1`,
        [singlesId, newEnc]
      );
    }

    await client.query('COMMIT');
    inTransaction = false;
    invalidateRecordVaultIconKeyCache();

    return { iconCount, tokenCount: tokenRows.length };
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const oldKey = await readCurrentMasterKey();
  const newKey =
    String(process.env.RECORD_NOTES_ICON_KEYS_MASTER_KEY_NEW ?? '').trim() || generateNewMasterKey();

  if (oldKey === newKey) {
    throw new Error('Generated new key matches the current key — aborting');
  }

  if (dryRun) {
    console.log('\n[dry-run] Verifying decrypt/re-encrypt (no database writes)...');
  } else {
    console.log('\nRotating keys on Primary...');
  }

  const { iconCount, tokenCount } = await rotateKeys(oldKey, newKey);

  return { newKey, iconCount, tokenCount };
}

main()
  .then(({ newKey, iconCount, tokenCount }) => {
    if (dryRun) {
      console.log('[dry-run] Decrypt/verify OK — no database writes.');
    } else {
      console.log('Rotated Record Vault master key on Primary.');
    }
    console.log(`  Icon secrets: ${iconCount}`);
    console.log(`  OneDrive tokens: ${tokenCount}`);
    console.log('');
    console.log('Success. Done');
    console.log('');
    console.log('Please put this key as the new RECORD_NOTES_ICON_KEYS_MASTER_KEY in ~/.ssh/be/.env on every server:');
    console.log('');
    console.log(`  RECORD_NOTES_ICON_KEYS_MASTER_KEY=${newKey}`);
    console.log('');
    console.log('Then run: pm2 restart vsingles');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
