-- outdateddbsnapshotoct2024.singles — government ID capture/history (text[]).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesGovIdArray.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS gov_id_array text[];

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.gov_id_array IS
  'Government ID data captured during Identification Verification (text array).';
