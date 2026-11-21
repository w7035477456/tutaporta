-- Align notes_vault.storage_backend with app E2E keys + Mac/Ubuntu code:
--   CHECK (storage_backend IN ('postgres', 'tutaCloud', 'usb'))
-- Live DBs drifted to CHECK (storage_backend = 'tutaCloud') only, which makes
-- "Set Encrypt Password" fail when the client upserts usb/onedrive rows.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/fixNotesVaultStorageBackendUsbOnedrive.sql
-- Ubuntu Primary:
--   scripts/ubuntu-psql.sh -f be/db/fixNotesVaultStorageBackendUsbOnedrive.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.notes_vault
  DROP CONSTRAINT IF EXISTS notes_vault_storage_backend_chk;

-- Existing TutaCloud rows used the label 'tutaCloud'; app backend slot is 'tutaCloud'.
UPDATE outdateddbsnapshotoct2024.notes_vault
   SET storage_backend = 'tutaCloud',
       updated_at = NOW()
 WHERE storage_backend = 'tutaCloud';

ALTER TABLE outdateddbsnapshotoct2024.notes_vault
  ADD CONSTRAINT notes_vault_storage_backend_chk
  CHECK (storage_backend IN ('postgres', 'tutaCloud', 'usb'));

COMMIT;
