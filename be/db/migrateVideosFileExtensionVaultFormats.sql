-- Extend outdateddbsnapshotoct2024.videos.file_extension for Public Video Vault uploads (mov, avi, wmv).
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/migrateVideosFileExtensionVaultFormats.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.videos
  DROP CONSTRAINT IF EXISTS videos_file_extension_check;

ALTER TABLE outdateddbsnapshotoct2024.videos
  ADD CONSTRAINT videos_file_extension_check CHECK (
    lower(file_extension::text) = ANY (
      ARRAY['webm'::text, 'mp4'::text, 'mp3'::text, 'mov'::text, 'avi'::text, 'wmv'::text]
    )
  );

COMMIT;
