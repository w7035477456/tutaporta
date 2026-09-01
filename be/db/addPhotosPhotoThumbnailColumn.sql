-- Add stored JPEG thumbnail filename for each photos row (generated on upload/save).
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addPhotosPhotoThumbnailColumn.sql

BEGIN;

ALTER TABLE helloworldjunktest.photos
  ADD COLUMN IF NOT EXISTS photo_thumbnail character varying(120);

COMMENT ON COLUMN helloworldjunktest.photos.photo_thumbnail IS
  'JPEG filename in TUTADATES_PHOTO_FOLDER ({photo_file_name}_thumb.jpg). NULL = no thumbnail yet; grid views fall back to full image.';

COMMIT;
