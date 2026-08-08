-- Store full DOB OCR (MM/DD/YYYY next to DOB label) or 'None Found'; was smallint birth year.
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/alterSinglesDlDobToText.sql

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN dl_dob TYPE text
  USING CASE
    WHEN dl_dob IS NULL THEN NULL
    ELSE dl_dob::text
  END;

COMMENT ON COLUMN helloworldjunktest.singles.dl_dob IS
  'Date of birth from driver license OCR (MM/DD/YYYY next to DOB label), or None Found.';
