-- Photo Albums (clone of Notes / Record Vault) — independent singles columns.
-- Does not rename or touch notes_* / record_notes_* columns.
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesPhotoAlbumsColumns.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS photoalbums_access_password_hash text,
  ADD COLUMN IF NOT EXISTS photoalbums_access_password_updated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS photoalbums_access_password_hint text,
  ADD COLUMN IF NOT EXISTS photoalbums_access_password_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS record_photoalbums_onedrive_email VARCHAR(256),
  ADD COLUMN IF NOT EXISTS record_photoalbums_drive_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_photoalbums_drive_folder_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS record_photoalbums_drive_email VARCHAR(256),
  ADD COLUMN IF NOT EXISTS record_photoalbums_dropbox_refresh_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS record_photoalbums_dropbox_folder_path TEXT,
  ADD COLUMN IF NOT EXISTS record_photoalbums_dropbox_email VARCHAR(256),
  ADD COLUMN IF NOT EXISTS photoalbums_total_transfer_mb integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photoalbums_onedrive_folder_mb integer,
  ADD COLUMN IF NOT EXISTS photoalbums_onedrive_folder_scanned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS photoalbums_session_usb_tx_rx_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photoalbums_session_ui_tx_rx_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photoalbums_last_session_usb_tx_rx_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photoalbums_last_session_ui_tx_rx_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN helloworldjunktest.singles.photoalbums_access_password_hash IS
  'bcrypt hash for Photo Albums Encrypt Password (independent from Notes).';

COMMENT ON COLUMN helloworldjunktest.singles.photoalbums_total_transfer_mb IS
  'Lifetime Photo Albums Tx/Rx MB. Independent from notes_total_transfer_mb.';

-- Deduct shared refill_remain_mb (same pool as Notes for now) and tally photoalbums_total_transfer_mb.
DROP FUNCTION IF EXISTS helloworldjunktest.add_photoalbums_transfer_mb(bigint, bigint);

CREATE FUNCTION helloworldjunktest.add_photoalbums_transfer_mb(
  p_singles_id bigint,
  p_bytes bigint
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_add_mb integer;
  v_remain integer;
BEGIN
  IF p_bytes IS NULL OR p_bytes <= 0 THEN
    SELECT refill_remain_mb INTO v_remain
    FROM helloworldjunktest.singles WHERE singles_id = p_singles_id;
    RETURN COALESCE(v_remain, 0);
  END IF;

  v_add_mb := GREATEST(1, CEIL(p_bytes::numeric / (1024 * 1024))::integer);

  UPDATE helloworldjunktest.singles
  SET
    photoalbums_total_transfer_mb = photoalbums_total_transfer_mb + v_add_mb,
    refill_remain_mb = refill_remain_mb - v_add_mb
  WHERE singles_id = p_singles_id
  RETURNING refill_remain_mb INTO v_remain;

  RETURN COALESCE(v_remain, 0);
END;
$$;

COMMIT;
