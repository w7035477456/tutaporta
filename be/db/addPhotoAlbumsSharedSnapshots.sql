-- Snapshot HTML + attachment copies when an album invite is sent (recipient viewing).
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addPhotoAlbumsSharedSnapshots.sql

BEGIN;

ALTER TABLE helloworldjunktest.photo_albums_invites
  ADD COLUMN IF NOT EXISTS snapshot_html TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ;

COMMIT;
