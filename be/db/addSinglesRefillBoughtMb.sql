-- Lifetime purchased/granted Tx/Rx data: singles.refill_bought_mb (MB).
-- Cumulative; increased by complimentary grant and token data-plan purchases.
-- Does not decrease when data is used (see refill_remain_mb for remaining balance).
--
-- Run on Primary (Mac tunnel example):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesRefillBoughtMb.sql
--
-- One-liner:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -c "
--     ALTER TABLE helloworldjunktest.singles
--       ADD COLUMN IF NOT EXISTS refill_bought_mb integer NOT NULL DEFAULT 10240;
--   "

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS refill_bought_mb integer NOT NULL DEFAULT 10240;

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN refill_bought_mb SET DEFAULT 10240;

COMMENT ON COLUMN helloworldjunktest.singles.refill_bought_mb IS
  'Tx/Rx quota envelope in MB after the latest purchase/grant. On refill: if remain<=0 set to buy size; if remain>0 set to remain+buy. Not reduced by transfers.';

-- Existing members: reconstruct lifetime bought from payment ledger when possible.
-- Do NOT set bought = remain (remain shrinks with usage; bought must stay cumulative).
WITH ledger AS (
  SELECT
    p.singles_id,
    SUM(
      CASE
        WHEN COALESCE(p.transaction_description, '') ILIKE '%Complimentary%Free Data%'
          THEN 10240
        WHEN COALESCE(p.transaction_description, '') ~* 'total[[:space:]]+([0-9]+)[[:space:]]*GB'
          THEN (
            (regexp_match(
              p.transaction_description,
              'total[[:space:]]+([0-9]+)[[:space:]]*GB',
              'i'
            ))[1]::integer * 1024
          )
        ELSE 0
      END
    )::integer AS bought_from_ledger
  FROM helloworldjunktest.payment p
  GROUP BY p.singles_id
)
UPDATE helloworldjunktest.singles s
SET refill_bought_mb = GREATEST(
  10240,
  COALESCE(s.refill_bought_mb, 0),
  COALESCE(l.bought_from_ledger, 0)
)
FROM ledger l
WHERE l.singles_id = s.singles_id;

-- Purchase/credit path: remain carry/replace + bought from remain snapshot + buy.
DROP FUNCTION IF EXISTS helloworldjunktest.add_vault_refill_mb(bigint, integer);

CREATE FUNCTION helloworldjunktest.add_vault_refill_mb(
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
