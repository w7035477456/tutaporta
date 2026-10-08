-- Replace legacy partial Track URLs (Play 1–3 garbage + blank 4–9) with global.default_music_url.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/backfillCustomMusicUrlFromGlobalDefaults.sql

BEGIN;

UPDATE outdateddbsnapshotoct2024.user_customization u
SET
  custom_music_url = g.default_music_url,
  load_default = true,
  updated_at = NOW()
FROM outdateddbsnapshotoct2024.global g
WHERE g.id = 1
  AND cardinality(g.default_music_url) >= 10
  AND (
    COALESCE(u.custom_music_url[1], '') ILIKE '%c7u5tTO7bdE%'
    OR COALESCE(u.custom_music_url[2], '') ILIKE '%g8J0GPXOA4U%'
    OR COALESCE(u.custom_music_url[3], '') ILIKE '%TNZceXN8FWA%'
    OR (
      COALESCE(u.custom_music_url[4], '') = ''
      AND COALESCE(u.custom_music_url[5], '') = ''
      AND COALESCE(u.custom_music_url[6], '') = ''
      AND COALESCE(u.custom_music_url[1], '') <> ''
    )
  );

COMMIT;

-- Verify: SELECT email, u.custom_music_url[1], u.custom_music_url[4]
--   FROM outdateddbsnapshotoct2024.user_customization u
--   JOIN outdateddbsnapshotoct2024.singles s USING (singles_id);
