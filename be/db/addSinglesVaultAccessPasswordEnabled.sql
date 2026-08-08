-- Optional Record Encrypt Password gate (separate from login + USB icon).
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesVaultAccessPasswordEnabled.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_access_password_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN helloworldjunktest.singles.notes_access_password_enabled IS
  'When true, Record Vault requires notes_access_password_hash before USB unlock. When false, skip Encrypt Password gate.';

-- Keep existing users who already set a Encrypt Password on the gated flow.
UPDATE helloworldjunktest.singles
SET notes_access_password_enabled = true
WHERE notes_access_password_hash IS NOT NULL
  AND notes_access_password_enabled = false;

COMMIT;
