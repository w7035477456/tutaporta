-- Rewrite absolute storage paths after renaming the on-disk folders:
--   onlinemallwebsite_storage            -> tutamallStorageFolder_outdatedOct2021
--   onlinemallwebsite_largecheapstorage  -> tutamallStorageFolder_largecheapstorage_outdatedOct2021
-- Data-only (no DDL). Idempotent. Run on Primary right after the folders are moved:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -f be/db/renameStorageFolderPathsTutamallOutdatedOct2021.sql

BEGIN;

UPDATE outdateddbsnapshotoct2024.photos
SET file_path = regexp_replace(regexp_replace(file_path,
      '/onlinemallwebsite_largecheapstorage(/|$)', '/tutamallStorageFolder_largecheapstorage_outdatedOct2021\1', 'g'),
      '/onlinemallwebsite_storage(/|$)', '/tutamallStorageFolder_outdatedOct2021\1', 'g')
WHERE file_path ~ '/onlinemallwebsite_(storage|largecheapstorage)(/|$)';

UPDATE outdateddbsnapshotoct2024.videos
SET file_path = regexp_replace(regexp_replace(file_path,
      '/onlinemallwebsite_largecheapstorage(/|$)', '/tutamallStorageFolder_largecheapstorage_outdatedOct2021\1', 'g'),
      '/onlinemallwebsite_storage(/|$)', '/tutamallStorageFolder_outdatedOct2021\1', 'g')
WHERE file_path ~ '/onlinemallwebsite_(storage|largecheapstorage)(/|$)';

UPDATE outdateddbsnapshotoct2024.vault_cluster_state
SET mount_path = regexp_replace(regexp_replace(mount_path,
      '/onlinemallwebsite_largecheapstorage(/|$)', '/tutamallStorageFolder_largecheapstorage_outdatedOct2021\1', 'g'),
      '/onlinemallwebsite_storage(/|$)', '/tutamallStorageFolder_outdatedOct2021\1', 'g')
WHERE mount_path ~ '/onlinemallwebsite_(storage|largecheapstorage)(/|$)';

UPDATE outdateddbsnapshotoct2024.vault_cluster_state
SET backup_mount_path = regexp_replace(regexp_replace(backup_mount_path,
      '/onlinemallwebsite_largecheapstorage(/|$)', '/tutamallStorageFolder_largecheapstorage_outdatedOct2021\1', 'g'),
      '/onlinemallwebsite_storage(/|$)', '/tutamallStorageFolder_outdatedOct2021\1', 'g')
WHERE backup_mount_path ~ '/onlinemallwebsite_(storage|largecheapstorage)(/|$)';

COMMIT;
