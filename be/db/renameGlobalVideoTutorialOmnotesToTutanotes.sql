-- Rename OMNotes tutorial column → TutaNotes.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/renameGlobalVideoTutorialOmnotesToTutanotes.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'global'
       AND column_name = 'video_tutorial_omnotes'
  ) AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'global'
       AND column_name = 'video_tutorial_tutanotes'
  ) THEN
    ALTER TABLE helloworldjunktest.global
      RENAME COLUMN video_tutorial_omnotes TO video_tutorial_tutanotes;
  ELSIF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'global'
       AND column_name = 'video_tutorial_tutanotes'
  ) THEN
    ALTER TABLE helloworldjunktest.global
      ADD COLUMN video_tutorial_tutanotes text;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.global.video_tutorial_tutanotes IS
  'YouTube (or other) URL for TutaNotes video tutorial; opened from /myNote Cloud/USB login panels.';

-- Drop leftover empty omnotes column if both somehow exist after a partial migrate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest' AND table_name = 'global'
       AND column_name = 'video_tutorial_omnotes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest' AND table_name = 'global'
       AND column_name = 'video_tutorial_tutanotes'
  ) THEN
    UPDATE helloworldjunktest.global g
       SET video_tutorial_tutanotes = COALESCE(
             NULLIF(BTRIM(g.video_tutorial_tutanotes), ''),
             NULLIF(BTRIM(g.video_tutorial_omnotes), '')
           )
     WHERE g.id = 1;
    ALTER TABLE helloworldjunktest.global DROP COLUMN video_tutorial_omnotes;
  END IF;
END $$;

COMMIT;

-- Verify: SELECT video_tutorial_tutanotes FROM helloworldjunktest.global WHERE id = 1;
