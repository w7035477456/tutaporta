-- Remove legacy helloworldjunktest.singles.user_status; singles.status is the only account status.
-- Backfills status from user_status where status is still blank, then drops user_status.
-- Primary only.
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/dropSinglesUserStatusColumn.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'user_status'
  ) THEN
    RAISE NOTICE 'helloworldjunktest.singles.user_status already removed — skipping.';
    RETURN;
  END IF;

  UPDATE helloworldjunktest.singles
  SET status = CASE LOWER(BTRIM(user_status::text))
    WHEN 'active' THEN 'active'::helloworldjunktest.singles_status
    WHEN 'cancel' THEN 'cancel'::helloworldjunktest.singles_status
    WHEN 'cencel' THEN 'cancel'::helloworldjunktest.singles_status
    WHEN 'canceled' THEN 'cancel'::helloworldjunktest.singles_status
    WHEN 'cancelled' THEN 'cancel'::helloworldjunktest.singles_status
    WHEN 'suspend' THEN 'suspend'::helloworldjunktest.singles_status
    WHEN 'suspended' THEN 'suspend'::helloworldjunktest.singles_status
    WHEN 'pause' THEN 'pause'::helloworldjunktest.singles_status
    WHEN 'abandon' THEN 'abandon'::helloworldjunktest.singles_status
    WHEN 'unknown' THEN 'unknown'::helloworldjunktest.singles_status
    WHEN 'other' THEN 'other'::helloworldjunktest.singles_status
    WHEN 'blank' THEN 'blank'::helloworldjunktest.singles_status
    ELSE status
  END,
  updated_at = CURRENT_TIMESTAMP
  WHERE status = 'blank'::helloworldjunktest.singles_status
    AND user_status IS NOT NULL
    AND BTRIM(user_status::text) <> '';

  ALTER TABLE helloworldjunktest.singles
    DROP COLUMN user_status;
END $$;
