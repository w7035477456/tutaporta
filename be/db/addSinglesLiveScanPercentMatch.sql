-- outdateddbsnapshotoct2024.singles — live scan percent match (Primary only).
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesLiveScanPercentMatch.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS live_scan_percent_match smallint;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.live_scan_percent_match IS
  'Live face scan to profile photo match percent during Identification Verification.';
