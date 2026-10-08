-- Rename outdateddbsnapshotoct2024.singles.live_scan_percentage_match → livescan_profile_percentage_match (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesLiveScanPercentageMatchToLivescanProfilePercentageMatch.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'live_scan_percentage_match'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'livescan_profile_percentage_match'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      RENAME COLUMN live_scan_percentage_match TO livescan_profile_percentage_match;
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.livescan_profile_percentage_match IS
  'Profile photo to live face scan match percent during Identification Verification.';
