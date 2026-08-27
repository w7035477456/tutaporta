-- Run on Primary only.
-- Uppercase helloworldjunktest.member_category_enum labels:
--   Public → PUBLIC, Admin → ADMIN, DemoUser → DEMOUSER, PilotUser → PILOTUSER,
--   RegularMember → REGULARMEMBER, AnyMember → ANYMEMBER
-- Idempotent: skips when enum already uses PUBLIC.

DO $$
DECLARE
  sch text := 'helloworldjunktest';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
    RAISE NOTICE 'Schema % not found — skipped', sch;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'member_category_enum'
  ) THEN
    RAISE NOTICE '%.member_category_enum not found — skipped', sch;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = sch AND t.typname = 'member_category_enum' AND e.enumlabel = 'PUBLIC'
  ) THEN
    RAISE NOTICE '%.member_category_enum already uppercase — skipped', sch;
    RETURN;
  END IF;

  CREATE TYPE helloworldjunktest.member_category_enum_new AS ENUM (
    'PUBLIC',
    'ADMIN',
    'DEMOUSER',
    'PILOTUSER',
    'REGULARMEMBER',
    'ANYMEMBER'
  );

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category DROP DEFAULT;

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category TYPE helloworldjunktest.member_category_enum_new
    USING (
      CASE UPPER(TRIM(member_category::text))
        WHEN 'PUBLIC' THEN 'PUBLIC'
        WHEN 'ADMIN' THEN 'ADMIN'
        WHEN 'DEMOUSER' THEN 'DEMOUSER'
        WHEN 'PILOTUSER' THEN 'PILOTUSER'
        WHEN 'REGULARMEMBER' THEN 'REGULARMEMBER'
        WHEN 'ANYMEMBER' THEN 'ANYMEMBER'
        WHEN 'PILOTA' THEN 'PUBLIC'
        WHEN 'PILOTB' THEN 'PUBLIC'
        ELSE 'PUBLIC'
      END
    )::helloworldjunktest.member_category_enum_new;

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category SET DEFAULT 'PUBLIC'::helloworldjunktest.member_category_enum_new;

  DROP TYPE helloworldjunktest.member_category_enum;
  ALTER TYPE helloworldjunktest.member_category_enum_new RENAME TO member_category_enum;

  RAISE NOTICE 'Uppercased %.member_category_enum', sch;
END $$;

SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'helloworldjunktest'
  AND t.typname = 'member_category_enum'
ORDER BY enumsortorder;
