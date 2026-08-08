-- helloworldjunktest.global.video_tutorial_tutanotes — site-wide TutaNotes tutorial YouTube URL.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addGlobalVideoTutorialTutanotes.sql

BEGIN;

ALTER TABLE helloworldjunktest.global
  ADD COLUMN IF NOT EXISTS video_tutorial_tutanotes text;

COMMENT ON COLUMN helloworldjunktest.global.video_tutorial_tutanotes IS
  'YouTube (or other) URL for TutaNotes video tutorial; opened from /myNote Cloud/USB login panels.';

-- Prefer any non-empty per-user value that was stored on singles before the move to global.
UPDATE helloworldjunktest.global g
SET video_tutorial_tutanotes = s.sample
FROM (
  SELECT NULLIF(BTRIM(video_tutorial_tutanotes), '') AS sample
    FROM helloworldjunktest.singles
   WHERE NULLIF(BTRIM(video_tutorial_tutanotes), '') IS NOT NULL
   ORDER BY singles_id
   LIMIT 1
) s
WHERE g.id = 1
  AND NULLIF(BTRIM(g.video_tutorial_tutanotes), '') IS NULL
  AND s.sample IS NOT NULL;

ALTER TABLE helloworldjunktest.singles
  DROP COLUMN IF EXISTS video_tutorial_tutanotes;

COMMIT;

-- Verify: SELECT video_tutorial_tutanotes FROM helloworldjunktest.global WHERE id = 1;
