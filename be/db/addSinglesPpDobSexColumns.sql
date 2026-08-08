-- Passport DOB / sex from Identification Verification step 4 OCR.
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesPpDobSexColumns.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS pp_dob text,
  ADD COLUMN IF NOT EXISTS pp_sex text;

COMMENT ON COLUMN helloworldjunktest.singles.pp_dob IS
  'Date of birth from passport OCR (MM/DD/YYYY next to Date of birth label or MRZ), or not found.';

COMMENT ON COLUMN helloworldjunktest.singles.pp_sex IS
  'Sex (M or F) from passport OCR next to Sex label or MRZ, or not found.';
