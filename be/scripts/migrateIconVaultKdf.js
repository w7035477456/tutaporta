/**
 * Icon vault KDF info / smoke test (Argon2id).
 *
 * Unlocking an existing SHA-256 icon vault with the correct security icon
 * auto-migrates vault.meta.json + re-seals db/photos/files (see vaultSession.js).
 *
 * Usage (from be/):
 *   node scripts/migrateIconVaultKdf.js
 *   node scripts/migrateIconVaultKdf.js --hash "any-secret-string"
 */
import crypto from 'crypto';
import {
  deriveVaultKeyFromIconSecretArgon2id,
  deriveVaultKeyFromIconSecretSha256,
  ICON_VAULT_KDF
} from '../utils/recordVaultIconKeys.js';

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--hash' && args[1]) {
    const secret = args[1];
    const salt = crypto.randomBytes(ICON_VAULT_KDF.saltLength);
    const t0 = Date.now();
    const argon = await deriveVaultKeyFromIconSecretArgon2id(secret, salt);
    const ms = Date.now() - t0;
    const sha = deriveVaultKeyFromIconSecretSha256(secret);
    console.log(
      JSON.stringify(
        {
          sha256KeyB64: sha.toString('base64'),
          argon2idKeyB64: argon.toString('base64'),
          saltB64: salt.toString('base64'),
          deriveMs: ms,
          params: ICON_VAULT_KDF
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Icon vault key derive is now Argon2id (AES-256-GCM cipher unchanged).

Migration: unlock any existing icon-encrypted USB/OneDrive vault with the correct
security icon — the server re-seals files and writes kdf + kdfSalt into vault.meta.json.

Smoke test:
  node scripts/migrateIconVaultKdf.js --hash "any-secret-string"
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
