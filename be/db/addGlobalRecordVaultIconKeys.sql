-- Record Vault USB encryption keys — one long random secret per FA5 object icon (server-only lookup).
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addGlobalRecordVaultIconKeys.sql
-- Then set RECORD_NOTES_ICON_KEYS_MASTER_KEY in ~/.ssh/be/.env and seed:
--   node be/scripts/migrateRecordVaultIconKeysToEncrypted.js  (if plaintext map already exists)
--   node be/scripts/seedRecordVaultIconKeys.js                 (fresh seed or re-seed)

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.global
  ADD COLUMN IF NOT EXISTS record_vault_icon_keys jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN outdateddbsnapshotoct2024.global.record_vault_icon_keys IS
  'Map of FA5 object icon kebab name -> long random encryption secret for Record Vault USB (never sent to client).';

COMMIT;
