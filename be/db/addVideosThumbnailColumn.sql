-- Add stored JPEG thumbnail filename for each videos row (play icon baked in on save).
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addVideosThumbnailColumn.sql

BEGIN;

ALTER TABLE helloworldjunktest.videos
  ADD COLUMN IF NOT EXISTS video_thumbnail character varying(120);

COMMENT ON COLUMN helloworldjunktest.videos.video_thumbnail IS
  'JPEG filename in the same folder as file_path (includes play-icon overlay). NULL = no thumbnail yet.';

COMMIT;
