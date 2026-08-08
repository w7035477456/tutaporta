-- helloworldjunktest.singles — live scan + passport photo match (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesLiveScanPpPhotoMatchColumns.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS livescan_profile_percentage_match smallint,
  ADD COLUMN IF NOT EXISTS pp_profile_percentage_match smallint,
  ADD COLUMN IF NOT EXISTS pp_profile_scan_result text;

COMMENT ON COLUMN helloworldjunktest.singles.livescan_profile_percentage_match IS
  'Profile photo to live face scan match percent during Identification Verification.';

COMMENT ON COLUMN helloworldjunktest.singles.pp_profile_percentage_match IS
  'Profile photo to passport face match percent during Identification Verification.';

COMMENT ON COLUMN helloworldjunktest.singles.pp_profile_scan_result IS
  'Profile photo to passport face scan result: Match when percent >= threshold; otherwise Not Match.';
