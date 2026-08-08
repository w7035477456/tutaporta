-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesSecretIconAttempts.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS secret_icon_attempt_count integer NOT NULL DEFAULT 1;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS secret_icon_attempt_datetime timestamptz NOT NULL DEFAULT '1970-01-01 00:00:00+00';

COMMENT ON COLUMN helloworldjunktest.singles.secret_icon_attempt_count IS
  'Failed security-icon verification count in current 24h window (shared across app servers).';

COMMENT ON COLUMN helloworldjunktest.singles.secret_icon_attempt_datetime IS
  'Start of current security-icon attempt window; epoch sentinel when no active window.';
