-- Rename helloworldjunktest.singles.dl_photo_percent_match → dl_profile_percent_match (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesDlPhotoPercentMatchToDlProfilePercentMatch.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_photo_percent_match'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_profile_percent_match'
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      RENAME COLUMN dl_photo_percent_match TO dl_profile_percent_match;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.dl_profile_percent_match IS
  'Profile photo to driver license face match percent during Identification Verification.';
