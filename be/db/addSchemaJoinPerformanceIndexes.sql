-- Schema-wide join / list indexes for outdateddbsnapshotoct2024 (non-notes tables).
-- Complements be/db/addNotesVaultJoinIndexes.sql and existing per-feature migrations.
--
-- Gaps found from live index inventory + hot query paths:
--   photo_albums_*  — same patterns as notes_* (tree list, shortcut joins, hard-delete by note)
--   photos          — album / load-by-member always filter on singles_id (no secondary index)
--   requests        — reverse lookups on singles_id_to (unique is from,to only)
--   consent_record  — list by member_id ORDER BY date_signed
--   florist_*       — wipe/admin by sender/receiver; items join on florist_order_id
--   speed_date_*    — indexes declared in addSpeedDateTables.sql were missing live; plus host/member
--
-- Run on Primary (Mac and Ubuntu):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSchemaJoinPerformanceIndexes.sql
--   scripts/ubuntu-psql.sh -f be/db/addSchemaJoinPerformanceIndexes.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- TutaPhotoAlbums vault index (mirror of notes_* join indexes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_photo_albums_notebooks_active
  ON outdateddbsnapshotoct2024.photo_albums_notebooks (singles_id, display_order, notebook_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photo_albums_notes_member_active
  ON outdateddbsnapshotoct2024.photo_albums_notes (singles_id, display_order, note_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photo_albums_shortcuts_member_order
  ON outdateddbsnapshotoct2024.photo_albums_shortcuts (singles_id, display_order, shortcut_id);

CREATE INDEX IF NOT EXISTS idx_photo_albums_shortcuts_notebook
  ON outdateddbsnapshotoct2024.photo_albums_shortcuts (singles_id, notebook_id);

CREATE INDEX IF NOT EXISTS idx_photo_albums_shortcuts_note
  ON outdateddbsnapshotoct2024.photo_albums_shortcuts (singles_id, note_id)
  WHERE note_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_photo_albums_note_keywords_member_normalized
  ON outdateddbsnapshotoct2024.photo_albums_note_keywords (singles_id, keyword_normalized, note_id);

CREATE INDEX IF NOT EXISTS idx_photo_albums_note_attachments_note
  ON outdateddbsnapshotoct2024.photo_albums_note_attachments (singles_id, note_id);

CREATE INDEX IF NOT EXISTS idx_photo_albums_note_extra_images_note
  ON outdateddbsnapshotoct2024.photo_albums_note_extra_images (singles_id, note_id);

-- ---------------------------------------------------------------------------
-- Profile / album photos
-- ---------------------------------------------------------------------------
-- getPublicPrivateAlbum: WHERE singles_id ORDER BY display_order, photos_id
-- loadPhotosBySinglesIds: WHERE singles_id = ANY(...) (leading singles_id covers)
CREATE INDEX IF NOT EXISTS idx_photos_singles_display
  ON outdateddbsnapshotoct2024.photos (singles_id, display_order, photos_id);

-- ---------------------------------------------------------------------------
-- Friend requests (incoming inbox)
-- ---------------------------------------------------------------------------
-- bioRequestNotifications / requestApprovalStay: WHERE singles_id_to = $1
CREATE INDEX IF NOT EXISTS idx_requests_singles_id_to
  ON outdateddbsnapshotoct2024.requests (singles_id_to, singles_id_from);

-- ---------------------------------------------------------------------------
-- Consent records
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_consent_record_member_signed
  ON outdateddbsnapshotoct2024.consent_record (member_id, date_signed DESC, consent_record_id DESC);

-- ---------------------------------------------------------------------------
-- Florist orders / line items
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_florist_orders_sender
  ON outdateddbsnapshotoct2024.florist_orders (sender_singles_id);

CREATE INDEX IF NOT EXISTS idx_florist_orders_receiver
  ON outdateddbsnapshotoct2024.florist_orders (receiver_singles_id);

CREATE INDEX IF NOT EXISTS idx_florist_order_items_order
  ON outdateddbsnapshotoct2024.florist_order_items (florist_order_id);

-- ---------------------------------------------------------------------------
-- Speed dating (addSpeedDateTables.sql declared these; re-apply if missing)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_speed_date_event_status
  ON outdateddbsnapshotoct2024.speed_date_event (status, starts_at);

CREATE INDEX IF NOT EXISTS idx_speed_date_event_host
  ON outdateddbsnapshotoct2024.speed_date_event (host_singles_id);

CREATE INDEX IF NOT EXISTS idx_speed_date_rsvp_joined
  ON outdateddbsnapshotoct2024.speed_date_rsvp (event_id)
  WHERE status = 'joined';

CREATE INDEX IF NOT EXISTS idx_speed_date_rsvp_singles
  ON outdateddbsnapshotoct2024.speed_date_rsvp (singles_id, event_id);

-- ---------------------------------------------------------------------------
-- Videos album listing (type filter after singles_id)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_videos_singles_type
  ON outdateddbsnapshotoct2024.videos (singles_id, type);

-- ---------------------------------------------------------------------------
-- Raffle event → host join
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_raffle_event_host
  ON outdateddbsnapshotoct2024.raffle_event (raffle_host_id);

COMMIT;
