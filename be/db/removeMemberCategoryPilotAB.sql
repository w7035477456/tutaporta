-- Run on Primary only.
-- Removes PilotA and PilotB from helloworldjunktest.member_category_enum.
-- Any singles rows still on those categories are moved to Public first.

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

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = sch AND t.typname = 'member_category_enum' AND e.enumlabel IN ('PilotA', 'PilotB')
  ) THEN
    RAISE NOTICE 'PilotA/PilotB not in %.member_category_enum — skipped', sch;
    RETURN;
  END IF;

  UPDATE helloworldjunktest.singles
  SET member_category = 'Public'::helloworldjunktest.member_category_enum,
      updated_at = CURRENT_TIMESTAMP
  WHERE member_category::text IN ('PilotA', 'PilotB');

  CREATE TYPE helloworldjunktest.member_category_enum_new AS ENUM (
    'Public', 'Admin', 'DemoUser', 'PilotUser'
  );

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category DROP DEFAULT;

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category TYPE helloworldjunktest.member_category_enum_new
    USING member_category::text::helloworldjunktest.member_category_enum_new;

  ALTER TABLE helloworldjunktest.singles
    ALTER COLUMN member_category SET DEFAULT 'Public'::helloworldjunktest.member_category_enum_new;

  DROP TYPE helloworldjunktest.member_category_enum;
  ALTER TYPE helloworldjunktest.member_category_enum_new RENAME TO member_category_enum;

  RAISE NOTICE 'Removed PilotA/PilotB from %.member_category_enum', sch;
END $$;

SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'helloworldjunktest'
  AND t.typname = 'member_category_enum'
ORDER BY enumsortorder;
