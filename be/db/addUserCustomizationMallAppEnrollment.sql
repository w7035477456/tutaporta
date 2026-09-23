-- Mall app enrollment (TutaDates / TutaNotes / TutaPhoto Albums) — per user in user_customization.
-- Default true for new rows; backfill sets all existing users to all three checked.
--
-- Mac (tunnel):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationMallAppEnrollment.sql
--
-- Ubuntu (local socket / Primary):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationMallAppEnrollment.sql
--   # or: sudo -u postgres psql -d onlinemallwebsite -f ...

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS tuta_dates_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tuta_notes_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tuta_albums_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN helloworldjunktest.user_customization.tuta_dates_enabled IS
  'Mall enrollment: user opted into TutaDates (dating). Default true.';
COMMENT ON COLUMN helloworldjunktest.user_customization.tuta_notes_enabled IS
  'Mall enrollment: user opted into TutaNotes. Default true.';
COMMENT ON COLUMN helloworldjunktest.user_customization.tuta_albums_enabled IS
  'Mall enrollment: user opted into TutaPhotos. Default true.';

-- Existing customization rows: all three checked.
UPDATE helloworldjunktest.user_customization
SET tuta_dates_enabled = true,
    tuta_notes_enabled = true,
    tuta_albums_enabled = true,
    updated_at = NOW()
WHERE tuta_dates_enabled IS DISTINCT FROM true
   OR tuta_notes_enabled IS DISTINCT FROM true
   OR tuta_albums_enabled IS DISTINCT FROM true;

-- Singles missing a customization row: create one with all three checked (other cols use table defaults).
INSERT INTO helloworldjunktest.user_customization (
  singles_id,
  tuta_dates_enabled,
  tuta_notes_enabled,
  tuta_albums_enabled
)
SELECT s.singles_id, true, true, true
FROM helloworldjunktest.singles s
WHERE NOT EXISTS (
  SELECT 1
  FROM helloworldjunktest.user_customization uc
  WHERE uc.singles_id = s.singles_id
);

-- Verify:
-- SELECT tuta_dates_enabled, tuta_notes_enabled, tuta_albums_enabled, COUNT(*)
-- FROM helloworldjunktest.user_customization
-- GROUP BY 1, 2, 3;
