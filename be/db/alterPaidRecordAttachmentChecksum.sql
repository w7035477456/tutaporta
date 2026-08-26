-- Add SHA-256 checksum to paid_record_attachment for duplicate upload detection.
-- Run:
--   psql … -f be/db/alterPaidRecordAttachmentChecksum.sql

ALTER TABLE helloworldjunktest.paid_record_attachment
  ADD COLUMN IF NOT EXISTS checksum text NULL;

COMMENT ON COLUMN helloworldjunktest.paid_record_attachment.checksum IS
  'SHA-256 hex of file bytes; used with byte_size to skip duplicate uploads.';

CREATE INDEX IF NOT EXISTS idx_paid_record_attachment_size_checksum
  ON helloworldjunktest.paid_record_attachment (paid_record_id, byte_size, checksum)
  WHERE checksum IS NOT NULL;
