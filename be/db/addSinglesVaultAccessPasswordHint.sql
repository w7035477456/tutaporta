-- Encrypt Password reminder hint (plaintext; optional).
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesVaultAccessPasswordHint.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_access_password_hint character varying(200);

COMMENT ON COLUMN helloworldjunktest.singles.notes_access_password_hint IS
  'Optional user reminder for Encrypt Password (not used for authentication).';

COMMIT;
