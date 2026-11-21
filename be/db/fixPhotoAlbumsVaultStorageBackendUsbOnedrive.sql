-- Align photo_albums_vault.storage_backend with app + addPhotoAlbumsVaultE2e.sql:
--   CHECK (storage_backend IN ('tutaCloud', 'usb'))
-- Live Mac DB drifted to CHECK (storage_backend = 'tutaCloud') only.

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.photo_albums_vault
  DROP CONSTRAINT IF EXISTS photo_albums_vault_storage_backend_chk;

UPDATE outdateddbsnapshotoct2024.photo_albums_vault
   SET storage_backend = 'tutaCloud',
       updated_at = NOW()
 WHERE storage_backend = 'tutaCloud';

ALTER TABLE outdateddbsnapshotoct2024.photo_albums_vault
  ADD CONSTRAINT photo_albums_vault_storage_backend_chk
  CHECK (storage_backend IN ('tutaCloud', 'usb'));

COMMIT;
