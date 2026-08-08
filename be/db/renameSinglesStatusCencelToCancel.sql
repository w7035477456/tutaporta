-- Fix typo: singles_status enum value cencel → cancel (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameSinglesStatusCencelToCancel.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'singles_status'
      AND e.enumlabel = 'cencel'
  ) THEN
    ALTER TYPE helloworldjunktest.singles_status RENAME VALUE 'cencel' TO 'cancel';
  END IF;
END $$;
