-- Photo Albums mobile QR uploads: purpose + staged file name under UPLOAD_FOLDER.
-- Safe to re-run. Bootstrap also runs via initMobilePhotoUploadSchema().

ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'profile';

ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
  ADD COLUMN IF NOT EXISTS stored_file_name text;
