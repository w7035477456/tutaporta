-- Driver license / government ID OCR capture (Identification Verification step 3).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesDlCaptureColumns.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS dl_firstname text,
  ADD COLUMN IF NOT EXISTS dl_middlename text,
  ADD COLUMN IF NOT EXISTS dl_lastname text,
  ADD COLUMN IF NOT EXISTS dl_dob text,
  ADD COLUMN IF NOT EXISTS dl_sex text,
  ADD COLUMN IF NOT EXISTS dl_height text,
  ADD COLUMN IF NOT EXISTS dl_city text,
  ADD COLUMN IF NOT EXISTS pp_nationality text;

COMMENT ON COLUMN helloworldjunktest.singles.dl_firstname IS
  'First name read from government ID OCR during Identification Verification step 3.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_middlename IS
  'Middle name or initial read from government ID OCR during Identification Verification step 3.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_lastname IS
  'Last name read from government ID OCR during Identification Verification step 3.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_dob IS
  'Date of birth from driver license OCR (MM/DD/YYYY next to DOB label), or None Found.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_sex IS
  'Sex (M or F) from driver license OCR next to Sex label, or "not found".';

COMMENT ON COLUMN helloworldjunktest.singles.dl_height IS
  'Height read from driver license OCR during Identification Verification step 3.';

COMMENT ON COLUMN helloworldjunktest.singles.dl_city IS
  'City read from government ID address OCR during Identification Verification step 3.';

COMMENT ON COLUMN helloworldjunktest.singles.pp_nationality IS
  'Passport nationality ISO3 (e.g. USA, GBR) from passport OCR during Identification Verification.';
