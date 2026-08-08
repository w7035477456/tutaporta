#!/usr/bin/env node
/**
 * Generate long random secrets for each FA5 object icon and store encrypted in
 * global.record_vault_icon_keys_enc (requires RECORD_NOTES_ICON_KEYS_MASTER_KEY).
 * Usage: node be/scripts/seedRecordVaultIconKeys.js
 */
import '../loadEnv.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/connection.js';
import { normalizeRecordVaultIconName } from '../utils/recordVaultIconKeys.js';
import { encryptRecordVaultIconKeyMap } from '../utils/recordVaultIconKeysCrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_LIST_PATH = path.resolve(__dirname, '../../fe/src/constants/fontAwesome5ObjectsIcons.json');

function generateSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

async function main() {
  const raw = fs.readFileSync(ICON_LIST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const icons = Array.isArray(parsed?.icons) ? parsed.icons : [];
  const map = {};
  for (const icon of icons) {
    const name = normalizeRecordVaultIconName(icon);
    if (!name) continue;
    map[name] = generateSecret();
  }

  const encBlob = encryptRecordVaultIconKeyMap(map);

  await pool.query(
    `UPDATE helloworldjunktest.global
     SET record_vault_icon_keys_enc = $1,
         record_vault_icon_keys = '{}'::jsonb
     WHERE id = 1`,
    [encBlob]
  );

  console.log(
    `Seeded ${Object.keys(map).length} Record Vault icon keys into global.record_vault_icon_keys_enc (encrypted)`
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
