-- Align vault_cluster_state.storage_type with app code + Mac:
--   CHECK (storage_type IN ('usb', 'tutaCloud'))
-- Ubuntu had drifted to CHECK (storage_type = 'tutaCloud') only, which makes
-- unlock fail after notes/photos index work (registerVaultClusterUnlock inserts 'tutaCloud').
--
-- Run on Primary (Ubuntu):
--   scripts/ubuntu-psql.sh -f be/db/fixVaultClusterStateStorageTypeUsbOnedrive.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  DROP CONSTRAINT IF EXISTS vault_cluster_state_storage_type_check;

-- Existing TutaCloud rows used the label 'tutaCloud'; app session slot is 'tutaCloud'.
UPDATE outdateddbsnapshotoct2024.vault_cluster_state
   SET storage_type = 'tutaCloud',
       updated_at = NOW()
 WHERE storage_type = 'tutaCloud';

ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  ADD CONSTRAINT vault_cluster_state_storage_type_check
  CHECK (storage_type IN ('usb', 'tutaCloud'));

COMMIT;
