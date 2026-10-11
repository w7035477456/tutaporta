-- TutaNotes Tx/Rx balance: singles.refill_remain_mb (MB). Deducted on transfer; may go negative.
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesRefillRemainMb.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS refill_remain_mb integer NOT NULL DEFAULT 10240;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN refill_remain_mb SET DEFAULT 10240;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN notes_total_transfer_mb TYPE integer
  USING notes_total_transfer_mb::integer;

-- Legacy calendar-period marker is intentionally removed. Data plans never reset.
ALTER TABLE outdateddbsnapshotoct2024.singles
  DROP COLUMN IF EXISTS vault_transfer_month;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.refill_remain_mb IS
  'TutaNotes Tx/Rx remaining balance in MB. New members start with 10240 (10GB complimentary). Deducted by transfers; increased by purchased/complimentary refills; may go negative (throttled).';

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.notes_total_transfer_mb IS
  'Lifetime TutaNotes Tx/Rx MB transferred. This counter does not reset.';

-- One-time seed from existing used/initial balance: remain = 100 - used (may be negative).
-- Re-run safe: only adjusts rows that look freshly defaulted with prior usage.
UPDATE outdateddbsnapshotoct2024.singles
SET refill_remain_mb = 100 - COALESCE(notes_total_transfer_mb, 0)
WHERE refill_remain_mb = 100
  AND COALESCE(notes_total_transfer_mb, 0) > 0;

DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.ensure_vault_transfer_month_current(bigint);
DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.ensure_vault_transfer_month_current(bigint, integer);
DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.add_notes_transfer_mb(bigint, bigint);
DROP FUNCTION IF EXISTS outdateddbsnapshotoct2024.add_vault_refill_mb(bigint, integer);

CREATE FUNCTION outdateddbsnapshotoct2024.add_notes_transfer_mb(
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
    FROM outdateddbsnapshotoct2024.singles WHERE singles_id = p_singles_id;
    RETURN COALESCE(v_remain, 0);
  END IF;

  v_add_mb := GREATEST(1, CEIL(p_bytes::numeric / (1024 * 1024))::integer);

  UPDATE outdateddbsnapshotoct2024.singles
  SET
    notes_total_transfer_mb = notes_total_transfer_mb + v_add_mb,
    refill_remain_mb = refill_remain_mb - v_add_mb
  WHERE singles_id = p_singles_id
  RETURNING refill_remain_mb INTO v_remain;

  RETURN COALESCE(v_remain, 0);
END;
$$;

CREATE FUNCTION outdateddbsnapshotoct2024.add_vault_refill_mb(
  p_singles_id bigint,
  p_add_mb integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_remain integer;
  v_add integer := GREATEST(0, COALESCE(p_add_mb, 0));
BEGIN
  -- Depleted/negative balances are zeroed on purchase; only positive remain carries forward.
  UPDATE outdateddbsnapshotoct2024.singles
  SET refill_remain_mb = CASE
    WHEN refill_remain_mb <= 0 THEN v_add
    ELSE refill_remain_mb + v_add
  END
  WHERE singles_id = p_singles_id
  RETURNING refill_remain_mb INTO v_remain;
  RETURN COALESCE(v_remain, 0);
END;
$$;

COMMIT;
