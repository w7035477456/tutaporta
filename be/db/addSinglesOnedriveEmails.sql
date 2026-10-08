-- outdateddbsnapshotoct2024.singles — remembered OneDrive Microsoft account emails (case-insensitive unique).
-- Nullable text[]: NULL = none saved yet.
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesOnedriveEmails.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS onedrive_emails text[];

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.onedrive_emails IS
  'Unique OneDrive Microsoft account emails used successfully with Record Vault. Case-insensitive uniqueness enforced in app.';
