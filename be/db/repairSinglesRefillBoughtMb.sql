-- Repair singles.refill_bought_mb when it was incorrectly set equal to refill_remain_mb
-- (early backfill) or never incremented by purchases (function deployed after first buy).
--
-- Lifetime bought = complimentary grants + token data-plan purchases from payment ledger.
-- Does NOT change with usage (refill_remain_mb does).
--
-- Run on Primary (Mac tunnel):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/repairSinglesRefillBoughtMb.sql

BEGIN;

-- Ensure purchase path still accumulates bought (idempotent with addSinglesRefillBoughtMb.sql).
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

-- Reconstruct lifetime purchased MB from payment descriptions.
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
  COALESCE(s.refill_bought_mb, 0),
  COALESCE(l.bought_from_ledger, 0),
  -- Never below current remain (over-quota remain can be negative; ignore then).
  CASE WHEN COALESCE(s.refill_remain_mb, 0) > 0 THEN s.refill_remain_mb ELSE 0 END
)
FROM ledger l
WHERE l.singles_id = s.singles_id
  AND GREATEST(
        COALESCE(s.refill_bought_mb, 0),
        COALESCE(l.bought_from_ledger, 0),
        CASE WHEN COALESCE(s.refill_remain_mb, 0) > 0 THEN s.refill_remain_mb ELSE 0 END
      ) IS DISTINCT FROM COALESCE(s.refill_bought_mb, 0);

COMMIT;
