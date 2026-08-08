-- Drop legacy livescan_profile_percentage_match; use live_scan_percent_match (Primary only).
-- Backfill first so existing rows keep their match percent.
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/dropSinglesLivescanProfilePercentageMatch.sql

UPDATE helloworldjunktest.singles
SET live_scan_percent_match = livescan_profile_percentage_match
WHERE live_scan_percent_match IS NULL
  AND livescan_profile_percentage_match IS NOT NULL;

ALTER TABLE helloworldjunktest.singles
  DROP COLUMN IF EXISTS livescan_profile_percentage_match;
