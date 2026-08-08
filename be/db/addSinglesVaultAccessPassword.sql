-- Record Encrypt Password — separate from login password; gates /myRecordVault before USB unlock.
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesVaultAccessPassword.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_access_password_hash text,
  ADD COLUMN IF NOT EXISTS notes_access_password_updated_at timestamp with time zone;

COMMENT ON COLUMN helloworldjunktest.singles.notes_access_password_hash IS
  'bcrypt hash for Record Vault page access (separate from login password_hash and USB PIN).';

COMMENT ON COLUMN helloworldjunktest.singles.notes_access_password_updated_at IS
  'When notes_access_password_hash was last set or changed.';

COMMIT;
