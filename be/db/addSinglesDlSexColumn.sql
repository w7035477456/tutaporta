-- Sex field from driver license OCR (Identification Verification step 3).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesDlSexColumn.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS dl_sex char(1);

COMMENT ON COLUMN helloworldjunktest.singles.dl_sex IS
  'Sex from driver license OCR: M or F (CHAR(1)); NULL when unknown.';
