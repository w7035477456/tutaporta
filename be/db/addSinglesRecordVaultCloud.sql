-- Record Vault OneDrive cloud storage columns.
-- Run against Primary: psql ... -f be/db/addSinglesRecordVaultCloud.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS record_notes_onedrive_email VARCHAR(256);
