-- Rename singles columns: vault → notes (and record_vault → record_notes).
-- Safe to re-run: only renames when the old column still exists.
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesVaultColumnsToNotes.sql

BEGIN;

DO $$
DECLARE
  renames text[][] := ARRAY[
    ARRAY['vault_access_password_hash', 'notes_access_password_hash'],
    ARRAY['vault_access_password_updated_at', 'notes_access_password_updated_at'],
    ARRAY['vault_access_password_hint', 'notes_access_password_hint'],
    ARRAY['vault_access_password_enabled', 'notes_access_password_enabled'],
    ARRAY['record_vault_drive_refresh_token_enc', 'record_notes_drive_refresh_token_enc'],
    ARRAY['record_vault_drive_folder_id', 'record_notes_drive_folder_id'],
    ARRAY['record_vault_drive_email', 'record_notes_drive_email'],
    ARRAY['record_vault_onedrive_refresh_token_enc', 'record_notes_onedrive_refresh_token_enc'],
    ARRAY['record_vault_onedrive_folder_id', 'record_notes_onedrive_folder_id'],
    ARRAY['record_vault_onedrive_email', 'record_notes_onedrive_email'],
    ARRAY['record_vault_dropbox_refresh_token_enc', 'record_notes_dropbox_refresh_token_enc'],
    ARRAY['record_vault_dropbox_folder_path', 'record_notes_dropbox_folder_path'],
    ARRAY['record_vault_dropbox_email', 'record_notes_dropbox_email'],
    ARRAY['vault_total_transfer_mb', 'notes_total_transfer_mb'],
    ARRAY['vault_onedrive_folder_mb', 'notes_onedrive_folder_mb'],
    ARRAY['vault_onedrive_folder_scanned_at', 'notes_onedrive_folder_scanned_at'],
    ARRAY['vault_session_usb_tx_rx_count', 'notes_session_usb_tx_rx_count'],
    ARRAY['vault_session_ui_tx_rx_count', 'notes_session_ui_tx_rx_count'],
    ARRAY['vault_last_session_usb_tx_rx_count', 'notes_last_session_usb_tx_rx_count'],
    ARRAY['vault_last_session_ui_tx_rx_count', 'notes_last_session_ui_tx_rx_count']
  ];
  pair text[];
  old_name text;
  new_name text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY renames LOOP
    old_name := pair[1];
    new_name := pair[2];
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'helloworldjunktest'
         AND table_name = 'singles'
         AND column_name = old_name
    ) AND NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'helloworldjunktest'
         AND table_name = 'singles'
         AND column_name = new_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE helloworldjunktest.singles RENAME COLUMN %I TO %I',
        old_name,
        new_name
      );
    END IF;
  END LOOP;
END $$;

-- Transfer helper: old name → new name (same body; column is notes_total_transfer_mb after rename).
DROP FUNCTION IF EXISTS helloworldjunktest.add_vault_transfer_mb(bigint, bigint);
DROP FUNCTION IF EXISTS helloworldjunktest.add_notes_transfer_mb(bigint, bigint);

CREATE FUNCTION helloworldjunktest.add_notes_transfer_mb(
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
    notes_total_transfer_mb = notes_total_transfer_mb + v_add_mb,
    refill_remain_mb = refill_remain_mb - v_add_mb
  WHERE singles_id = p_singles_id
  RETURNING refill_remain_mb INTO v_remain;

  RETURN COALESCE(v_remain, 0);
END;
$$;

COMMIT;
