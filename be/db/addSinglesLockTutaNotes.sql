-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesLockTutaNotes.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS lock_tuta_notes boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN helloworldjunktest.singles.lock_tuta_notes IS
  'When true, TutaNotes (Encrypt Password gate) is locked until admin clears — set after 5 consecutive wrong Encrypt Password attempts.';
