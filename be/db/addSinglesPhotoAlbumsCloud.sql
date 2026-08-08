-- Alias / subset: OneDrive columns for Photo Albums (also in addSinglesPhotoAlbumsColumns.sql).
ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_email VARCHAR(256);
