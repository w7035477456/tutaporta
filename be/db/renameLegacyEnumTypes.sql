-- Run on Primary only.
-- Renames legacy enum types to *_enum naming (matches posting_visibility_enum, request_status_enum).
--
--   approval_status   -> approval_status_enum
--   member_category   -> member_category_enum
--   photo_type        -> photo_type_enum
--
-- Column names are unchanged; only the PostgreSQL TYPE names change.

DO $$
DECLARE
  sch text := 'helloworldjunktest';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
    RAISE NOTICE 'Schema % not found — skipped', sch;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'approval_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'approval_status_enum'
  ) THEN
    EXECUTE format('ALTER TYPE %I.approval_status RENAME TO approval_status_enum', sch);
    RAISE NOTICE 'Renamed %.approval_status -> approval_status_enum', sch;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'member_category'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'member_category_enum'
  ) THEN
    EXECUTE format('ALTER TYPE %I.member_category RENAME TO member_category_enum', sch);
    RAISE NOTICE 'Renamed %.member_category -> member_category_enum', sch;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'photo_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'photo_type_enum'
  ) THEN
    EXECUTE format('ALTER TYPE %I.photo_type RENAME TO photo_type_enum', sch);
    RAISE NOTICE 'Renamed %.photo_type -> photo_type_enum', sch;
  END IF;
END $$;

-- Verify:
SELECT n.nspname AS schema, t.typname AS enum_name, e.enumlabel AS element
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'helloworldjunktest'
  AND t.typname IN (
    'approval_status_enum',
    'member_category_enum',
    'photo_type_enum',
    'request_status_enum',
    'posting_visibility_enum',
    'sound_preference_enum'
  )
ORDER BY t.typname, e.enumsortorder;
