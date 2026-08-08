-- Rename helloworldjunktest.singles.pp_photo_percentage_match → pp_profile_percentage_match (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesPpPhotoPercentageMatchToPpProfilePercentageMatch.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'pp_photo_percentage_match'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'pp_profile_percentage_match'
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      RENAME COLUMN pp_photo_percentage_match TO pp_profile_percentage_match;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.pp_profile_percentage_match IS
  'Profile photo to passport face match percent during Identification Verification.';
