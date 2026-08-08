-- helloworldjunktest.singles — three nullable FK slots for self-intro videos.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesSelfIntroVideoFks.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS video1_fk bigint,
  ADD COLUMN IF NOT EXISTS video2_fk bigint,
  ADD COLUMN IF NOT EXISTS video3_fk bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video1_fk_fkey') THEN
    ALTER TABLE helloworldjunktest.singles
      ADD CONSTRAINT singles_video1_fk_fkey
      FOREIGN KEY (video1_fk) REFERENCES helloworldjunktest.videos (video_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video2_fk_fkey') THEN
    ALTER TABLE helloworldjunktest.singles
      ADD CONSTRAINT singles_video2_fk_fkey
      FOREIGN KEY (video2_fk) REFERENCES helloworldjunktest.videos (video_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video3_fk_fkey') THEN
    ALTER TABLE helloworldjunktest.singles
      ADD CONSTRAINT singles_video3_fk_fkey
      FOREIGN KEY (video3_fk) REFERENCES helloworldjunktest.videos (video_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.video1_fk IS 'Self-intro video slot 1 → helloworldjunktest.videos.video_id';
COMMENT ON COLUMN helloworldjunktest.singles.video2_fk IS 'Self-intro video slot 2 → helloworldjunktest.videos.video_id';
COMMENT ON COLUMN helloworldjunktest.singles.video3_fk IS 'Self-intro video slot 3 → helloworldjunktest.videos.video_id';

COMMIT;
