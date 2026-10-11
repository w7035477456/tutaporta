-- Record Vault lifetime transfer tally (upload + download bytes for note/photo CRUD).
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesVaultTransferTracking.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS notes_total_transfer_mb integer NOT NULL DEFAULT 0;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN notes_total_transfer_mb TYPE integer
  USING notes_total_transfer_mb::integer;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.notes_total_transfer_mb IS
  'Lifetime MB transferred to/from vault cloud storage (photo/note CRUD). This counter does not reset.';

ALTER TABLE outdateddbsnapshotoct2024.singles
  DROP COLUMN IF EXISTS vault_transfer_month;

DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.ensure_vault_transfer_month_current(bigint);
DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.ensure_vault_transfer_month_current(bigint, integer);
DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.add_notes_transfer_mb(bigint, bigint);

CREATE FUNCTION outdateddbsnapshotoct2024.add_notes_transfer_mb(
  p_singles_id bigint,
  p_bytes bigint
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_add_mb integer;
  v_total integer;
BEGIN
  IF p_bytes IS NULL OR p_bytes <= 0 THEN
    SELECT notes_total_transfer_mb INTO v_total
    FROM outdateddbsnapshotoct2024.singles WHERE singles_id = p_singles_id;
    RETURN COALESCE(v_total, 0);
  END IF;

  v_add_mb := GREATEST(1, CEIL(p_bytes::numeric / (1024 * 1024))::integer);

  UPDATE outdateddbsnapshotoct2024.singles
  SET notes_total_transfer_mb = notes_total_transfer_mb + v_add_mb
  WHERE singles_id = p_singles_id
  RETURNING notes_total_transfer_mb INTO v_total;

  RETURN COALESCE(v_total, 0);
END;
$$;

COMMIT;
