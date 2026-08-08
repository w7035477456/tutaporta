-- Purchase rules for singles.refill_bought_mb (Data Plans / token refill):
--   1) If Remaining (refill_remain_mb) <= 0: refill_bought_mb = latest buy only
--   2) If Remaining > 0: refill_bought_mb = Remaining + latest buy
-- Remain credit is unchanged (carry positive remain, else replace with buy).
--
-- Run on Primary (Mac tunnel):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/updateAddVaultRefillMbBoughtRules.sql

BEGIN;

COMMENT ON COLUMN helloworldjunktest.singles.refill_bought_mb IS
  'Tx/Rx quota envelope in MB after the latest purchase/grant. On refill: if remain<=0 set to buy size; if remain>0 set to remain+buy. Not reduced by transfers.';

CREATE OR REPLACE FUNCTION helloworldjunktest.add_vault_refill_mb(
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
  -- Remain: depleted/negative balances are replaced by the buy; positive remain carries forward.
  -- Bought: same remain snapshot — buy only when over-quota; remain+buy when still positive.
  UPDATE helloworldjunktest.singles
  SET
    refill_bought_mb = CASE
      WHEN refill_remain_mb <= 0 THEN v_add
      ELSE refill_remain_mb + v_add
    END,
    refill_remain_mb = CASE
      WHEN refill_remain_mb <= 0 THEN v_add
      ELSE refill_remain_mb + v_add
    END
  WHERE singles_id = p_singles_id
  RETURNING refill_remain_mb INTO v_remain;
  RETURN COALESCE(v_remain, 0);
END;
$$;

COMMIT;
