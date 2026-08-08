-- Verify Record Vault OneDrive cloud columns exist on singles (run on same DB host the app uses).
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'helloworldjunktest'
   AND table_name = 'singles'
   AND column_name LIKE 'record_notes_onedrive_%'
 ORDER BY column_name;

-- Expect 3 rows:
-- record_notes_onedrive_email
-- record_notes_onedrive_folder_id
-- record_notes_onedrive_refresh_token_enc
