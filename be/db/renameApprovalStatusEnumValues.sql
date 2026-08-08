-- Rename approval_status_enum values to match product labels:
--   denied -> deny
--   na     -> noresponse
-- approve is unchanged.
--
-- Mac dev (from repo root):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameApprovalStatusEnumValues.sql

DO $$
DECLARE
  sch text := 'helloworldjunktest';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = sch
      AND t.typname = 'approval_status_enum'
      AND e.enumlabel = 'denied'
  ) THEN
    EXECUTE format('ALTER TYPE %I.approval_status_enum RENAME VALUE ''denied'' TO ''deny''', sch);
    RAISE NOTICE 'Renamed %.approval_status_enum denied -> deny', sch;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = sch
      AND t.typname = 'approval_status_enum'
      AND e.enumlabel = 'na'
  ) THEN
    EXECUTE format('ALTER TYPE %I.approval_status_enum RENAME VALUE ''na'' TO ''noresponse''', sch);
    RAISE NOTICE 'Renamed %.approval_status_enum na -> noresponse', sch;
  END IF;
END $$;
