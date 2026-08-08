-- Live face scan ↔ profile photo match (Identification Verification Save).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesDlPhotoMatchColumns.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS dl_profile_percent_match smallint,
  ADD COLUMN IF NOT EXISTS dl_profile_scan_result text;

COMMENT ON COLUMN helloworldjunktest.singles.dl_profile_percent_match IS
  'Profile photo to driver license face match percent during Identification Verification.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_profile_scan_result IS
  'Profile photo to driver license face scan result: Match when percent >= threshold; otherwise Not Match.';
