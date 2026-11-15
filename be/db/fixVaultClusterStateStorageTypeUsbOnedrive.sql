-- Align vault_cluster_state.storage_type with app code + Mac:
--   CHECK (storage_type IN ('usb', 'onedrive'))
-- Ubuntu had drifted to CHECK (storage_type = 'tutadrive') only, which makes
-- unlock fail after notes/photos index work (registerVaultClusterUnlock inserts 'onedrive').
--
-- Run on Primary (Ubuntu):
--   scripts/ubuntu-psql.sh -f be/db/fixVaultClusterStateStorageTypeUsbOnedrive.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  DROP CONSTRAINT IF EXISTS vault_cluster_state_storage_type_check;

-- Existing TutaCloud rows used the label 'tutadrive'; app session slot is 'onedrive'.
UPDATE outdateddbsnapshotoct2024.vault_cluster_state
   SET storage_type = 'onedrive',
       updated_at = NOW()
 WHERE storage_type = 'tutadrive';

ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  ADD CONSTRAINT vault_cluster_state_storage_type_check
  CHECK (storage_type IN ('usb', 'onedrive'));

COMMIT;
