-- outdateddbsnapshotoct2024.singles — three nullable FK slots for self-intro videos.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesSelfIntroVideoFks.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS video1_fk bigint,
  ADD COLUMN IF NOT EXISTS video2_fk bigint,
  ADD COLUMN IF NOT EXISTS video3_fk bigint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video1_fk_fkey') THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD CONSTRAINT singles_video1_fk_fkey
      FOREIGN KEY (video1_fk) REFERENCES outdateddbsnapshotoct2024.videos (video_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video2_fk_fkey') THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD CONSTRAINT singles_video2_fk_fkey
      FOREIGN KEY (video2_fk) REFERENCES outdateddbsnapshotoct2024.videos (video_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'singles_video3_fk_fkey') THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD CONSTRAINT singles_video3_fk_fkey
      FOREIGN KEY (video3_fk) REFERENCES outdateddbsnapshotoct2024.videos (video_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.video1_fk IS 'Self-intro video slot 1 → outdateddbsnapshotoct2024.videos.video_id';
COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.video2_fk IS 'Self-intro video slot 2 → outdateddbsnapshotoct2024.videos.video_id';
COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.video3_fk IS 'Self-intro video slot 3 → outdateddbsnapshotoct2024.videos.video_id';

COMMIT;
