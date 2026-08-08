-- Byte-accurate Photo Albums transfer deduction (no 1 MB minimum per flush).
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/updatePhotoAlbumsTransferMbDeduction.sql

BEGIN;

CREATE OR REPLACE FUNCTION helloworldjunktest.add_photoalbums_transfer_mb(
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

  v_add_mb := CEIL(p_bytes::numeric / (1024.0 * 1024.0))::integer;

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
