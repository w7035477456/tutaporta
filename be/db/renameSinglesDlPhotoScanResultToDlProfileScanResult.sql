-- Rename helloworldjunktest.singles.dl_photo_scan_result → dl_profile_scan_result (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesDlPhotoScanResultToDlProfileScanResult.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_photo_scan_result'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_profile_scan_result'
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      RENAME COLUMN dl_photo_scan_result TO dl_profile_scan_result;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.dl_profile_scan_result IS
  'Profile photo to driver license face scan result: Match when percent >= threshold; otherwise Not Match.';
