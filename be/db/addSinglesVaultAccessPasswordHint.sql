-- Encrypt Password reminder hint (plaintext; optional).
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesVaultAccessPasswordHint.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS notes_access_password_hint character varying(200);

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.notes_access_password_hint IS
  'Optional user reminder for Encrypt Password (not used for authentication).';

COMMIT;
