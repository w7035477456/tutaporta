-- profile_dl_match + profile_livescan_match are the only stored face-match scores for the
-- driver license / live scan (ID seal needs both > 80, be/utils/idSeal.js). 0 = not measured.
-- Passport scores (pp_profile_percent_match / pp_profile_scan_result) are separate and stay.
BEGIN;

UPDATE outdateddbsnapshotoct2024.singles SET profile_dl_match = 0 WHERE profile_dl_match IS NULL;
UPDATE outdateddbsnapshotoct2024.singles SET profile_livescan_match = 0 WHERE profile_livescan_match IS NULL;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN profile_dl_match SET DEFAULT 0,
  ALTER COLUMN profile_dl_match SET NOT NULL,
  ALTER COLUMN profile_livescan_match SET DEFAULT 0,
  ALTER COLUMN profile_livescan_match SET NOT NULL;

ALTER TABLE outdateddbsnapshotoct2024.singles
  DROP COLUMN IF EXISTS dl_profile_percent_match,
  DROP COLUMN IF EXISTS dl_profile_scan_result,
  DROP COLUMN IF EXISTS live_scan_percent_match;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.profile_dl_match IS
  'Percent match of the profile photo to the driver license face. 0 = not measured. ID seal needs > 80.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.profile_livescan_match IS
  'Percent match of the live face scan to BOTH the profile photo and the driver license (lower of the two). 0 = not measured. ID seal needs > 80.';

COMMIT;
