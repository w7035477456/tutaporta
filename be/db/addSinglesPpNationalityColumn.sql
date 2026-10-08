-- Passport nationality ISO3 from government ID OCR (Identification Verification).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesPpNationalityColumn.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS pp_nationality text;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.pp_nationality IS
  'Passport nationality ISO3 (e.g. USA, GBR) from passport OCR during Identification Verification.';
