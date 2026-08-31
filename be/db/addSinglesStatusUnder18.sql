-- helloworldjunktest.singles_status: under18 — blocked after ID OCR age < 18.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesStatusUnder18.sql
-- Prod Primary only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'singles_status'
      AND e.enumlabel = 'under18'
  ) THEN
    ALTER TYPE helloworldjunktest.singles_status ADD VALUE 'under18';
  END IF;
END $$;

COMMENT ON TYPE helloworldjunktest.singles_status IS
  'Account status. under18 = government ID OCR age under 18; login blocked.';
