-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesLockTutaPhotos.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/addSinglesLockTutaPhotos.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS lock_tuta_photos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.lock_tuta_photos IS
  'When true, TutaPhotos (Encrypt Password gate) is locked until admin clears — set after 6 consecutive wrong Encrypt Password attempts (cooldown after the 3rd).';

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.lock_tuta_notes IS
  'When true, TutaNotes (Encrypt Password gate) is locked until admin clears — set after 6 consecutive wrong Encrypt Password attempts (cooldown after the 3rd).';
