-- Point helloworldjunktest.videos.file_path at the video folder (sibling of photos/).
-- On-disk files may already live under ~/onlinemallwebsite_storage/videos/ while file_path still says photos/.
--
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/migrateVideosFilePathToVideoFolder.sql

BEGIN;

UPDATE helloworldjunktest.videos v
SET file_path = regexp_replace(rtrim(v.file_path, '/'), '/photos$', '/videos')
WHERE v.file_path IS NOT NULL
  AND v.file_path ~ '/photos/?$'
  AND regexp_replace(rtrim(v.file_path, '/'), '/photos$', '/videos') <> rtrim(v.file_path, '/');

COMMIT;
