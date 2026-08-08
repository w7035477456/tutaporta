-- Encrypt Record Vault icon secrets at rest (AES-256-GCM blob; master key in ~/.ssh/be/.env).
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addGlobalRecordVaultIconKeysEnc.sql
-- Set RECORD_NOTES_ICON_KEYS_MASTER_KEY in ~/.ssh/be/.env, then:
--   node be/scripts/migrateRecordVaultIconKeysToEncrypted.js   (existing plaintext map)
--   node be/scripts/seedRecordVaultIconKeys.js                  (fresh seed)

BEGIN;

ALTER TABLE helloworldjunktest.global
  ADD COLUMN IF NOT EXISTS record_vault_icon_keys_enc text;

COMMENT ON COLUMN helloworldjunktest.global.record_vault_icon_keys_enc IS
  'AES-256-GCM encrypted JSON map (icon kebab name -> secret). Base64(iv||tag||ciphertext). Decrypt only in BE with RECORD_NOTES_ICON_KEYS_MASTER_KEY.';

COMMENT ON COLUMN helloworldjunktest.global.record_vault_icon_keys IS
  'DEPRECATED — plaintext icon secrets. Cleared after migrateRecordVaultIconKeysToEncrypted.js; use record_vault_icon_keys_enc.';

COMMIT;
