-- OneDrive storage for Record Vault (encrypted refresh token + folder id).
-- Run against Primary: psql ... -f be/db/addSinglesRecordVaultOneDrive.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_email VARCHAR(256);
