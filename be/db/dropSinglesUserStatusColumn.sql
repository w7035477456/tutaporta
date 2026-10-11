-- Remove legacy outdateddbsnapshotoct2024.singles.user_status; singles.status is the only account status.
-- Backfills status from user_status where status is still blank, then drops user_status.
-- Primary only.
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/dropSinglesUserStatusColumn.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'user_status'
  ) THEN
    RAISE NOTICE 'outdateddbsnapshotoct2024.singles.user_status already removed — skipping.';
    RETURN;
  END IF;

  UPDATE outdateddbsnapshotoct2024.singles
  SET status = CASE LOWER(BTRIM(user_status::text))
    WHEN 'active' THEN 'active'::outdateddbsnapshotoct2024.singles_status
    WHEN 'cancel' THEN 'cancel'::outdateddbsnapshotoct2024.singles_status
    WHEN 'cencel' THEN 'cancel'::outdateddbsnapshotoct2024.singles_status
    WHEN 'canceled' THEN 'cancel'::outdateddbsnapshotoct2024.singles_status
    WHEN 'cancelled' THEN 'cancel'::outdateddbsnapshotoct2024.singles_status
    WHEN 'suspend' THEN 'suspend'::outdateddbsnapshotoct2024.singles_status
    WHEN 'suspended' THEN 'suspend'::outdateddbsnapshotoct2024.singles_status
    WHEN 'pause' THEN 'pause'::outdateddbsnapshotoct2024.singles_status
    WHEN 'abandon' THEN 'abandon'::outdateddbsnapshotoct2024.singles_status
    WHEN 'unknown' THEN 'unknown'::outdateddbsnapshotoct2024.singles_status
    WHEN 'other' THEN 'other'::outdateddbsnapshotoct2024.singles_status
    WHEN 'blank' THEN 'blank'::outdateddbsnapshotoct2024.singles_status
    ELSE status
  END,
  updated_at = CURRENT_TIMESTAMP
  WHERE status = 'blank'::outdateddbsnapshotoct2024.singles_status
    AND user_status IS NOT NULL
    AND BTRIM(user_status::text) <> '';

  ALTER TABLE outdateddbsnapshotoct2024.singles
    DROP COLUMN user_status;
END $$;
