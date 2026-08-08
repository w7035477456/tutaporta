#!/usr/bin/env node
/**
 * One-time migration: encrypt existing plaintext global.record_vault_icon_keys into
 * record_vault_icon_keys_enc and clear the plaintext column.
 *
 * Prerequisites:
 *   1. psql -f be/db/addGlobalRecordVaultIconKeysEnc.sql
 *   2. RECORD_NOTES_ICON_KEYS_MASTER_KEY in ~/.ssh/be/.env
 *
 * Usage: node be/scripts/migrateRecordVaultIconKeysToEncrypted.js
 */
import '../loadEnv.js';
import pool from '../db/connection.js';
import { encryptRecordVaultIconKeyMap } from '../utils/recordVaultIconKeysCrypto.js';
import { invalidateRecordVaultIconKeyCache } from '../utils/recordVaultIconKeys.js';

async function main() {
  const result = await pool.query(
    `SELECT record_vault_icon_keys, record_vault_icon_keys_enc
     FROM helloworldjunktest.global
     WHERE id = 1
     LIMIT 1`
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('global row id=1 not found');
  }

  const existingEnc = String(row.record_vault_icon_keys_enc ?? '').trim();
  if (existingEnc) {
    console.log('record_vault_icon_keys_enc is already set — nothing to migrate.');
    await pool.end();
    return;
  }

  const raw = row.record_vault_icon_keys;
  const map = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const count = Object.keys(map).length;
  if (count === 0) {
    throw new Error(
      'Plaintext record_vault_icon_keys is empty. Run node be/scripts/seedRecordVaultIconKeys.js instead.'
    );
  }

  const encBlob = encryptRecordVaultIconKeyMap(map);
  await pool.query(
    `UPDATE helloworldjunktest.global
     SET record_vault_icon_keys_enc = $1,
         record_vault_icon_keys = '{}'::jsonb
     WHERE id = 1`,
    [encBlob]
  );

  invalidateRecordVaultIconKeyCache();
  console.log(`Migrated ${count} icon secrets to record_vault_icon_keys_enc and cleared plaintext column.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
