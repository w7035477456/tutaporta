-- helloworldjunktest.singles — last live face scan time (Primary only).
-- Used with LIVE_SCAN_COOLDOWN (minutes) so round-robin app servers share one cooldown
-- instead of per-browser session state.
-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesLastLiveFaceScanAt.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS last_live_face_scan_at timestamptz;

COMMENT ON COLUMN helloworldjunktest.singles.last_live_face_scan_at IS
  'UTC timestamp of the member''s most recent Rekognition live face scan attempt (session start or completion). NULL until first scan. Enforce LIVE_SCAN_COOLDOWN minutes before allowing another scan.';
