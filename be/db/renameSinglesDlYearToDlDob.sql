-- Rename driver-license DOB capture column: dl_year → dl_dob (birth year from ID OCR).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesDlYearToDlDob.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_year'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'dl_dob'
  ) THEN
    ALTER TABLE helloworldjunktest.singles RENAME COLUMN dl_year TO dl_dob;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.dl_dob IS
  'Date of birth from driver license OCR (MM/DD/YYYY next to DOB label), or None Found.';
