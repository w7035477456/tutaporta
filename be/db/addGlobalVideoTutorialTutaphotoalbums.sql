-- outdateddbsnapshotoct2024.global.video_tutorial_tutaphotoalbums — site-wide TutaPhotoAlbums tutorial URL.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addGlobalVideoTutorialTutaphotoalbums.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.global
  ADD COLUMN IF NOT EXISTS video_tutorial_tutaphotoalbums text;

COMMENT ON COLUMN outdateddbsnapshotoct2024.global.video_tutorial_tutaphotoalbums IS
  'YouTube (or other) URL for TutaPhotoAlbums video tutorial; opened from /myPhotoAlbums Cloud/USB login panels.';

COMMIT;

-- Verify: SELECT video_tutorial_tutaphotoalbums FROM outdateddbsnapshotoct2024.global WHERE id = 1;
