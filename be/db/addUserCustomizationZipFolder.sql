-- user_customization.zip_folder — folder the member last picked for TutaNotes backup zip downloads
-- (e.g. '~/Downloads/download_zip'). NULL until the first Download.

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ADD COLUMN IF NOT EXISTS zip_folder text NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.zip_folder IS
  'Folder last picked for TutaNotes backup zip downloads (zips go into its download_zip subfolder). NULL = not chosen yet.';
