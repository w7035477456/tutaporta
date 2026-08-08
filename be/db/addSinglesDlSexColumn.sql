-- Sex field from driver license OCR (Identification Verification step 3).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesDlSexColumn.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS dl_sex text;

COMMENT ON COLUMN helloworldjunktest.singles.dl_sex IS
  'Sex (M or F) from driver license OCR next to Sex label, or "not found".';
