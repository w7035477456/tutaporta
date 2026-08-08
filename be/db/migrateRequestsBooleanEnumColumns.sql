-- Run on Primary only.
-- Converts helloworldjunktest.requests.interested, brief_paid, full_paid
-- to boolean_enum ('true' | 'false') with DEFAULT 'false'.
-- Requires be/db/renameRequestsPaidColumns.sql (brief_paid / full_paid column names).

DO $$
DECLARE
  sch text := 'helloworldjunktest';
  col text;
  req_cols text[] := ARRAY['interested', 'brief_paid', 'full_paid'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
    RAISE NOTICE 'Schema % not found — skipped', sch;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch AND t.typname = 'boolean_enum'
  ) THEN
    EXECUTE format('CREATE TYPE %I.boolean_enum AS ENUM (''true'', ''false'')', sch);
    RAISE NOTICE 'Created %.boolean_enum', sch;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = sch AND table_name = 'requests'
  ) THEN
    RAISE NOTICE 'Table %.requests not found — skipped', sch;
    RETURN;
  END IF;

  FOREACH col IN ARRAY req_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = sch
        AND table_name = 'requests'
        AND column_name = col
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = sch
        AND table_name = 'requests'
        AND column_name = col
        AND udt_name = 'boolean_enum'
    ) THEN
      RAISE NOTICE '%.requests.% already boolean_enum — skipped', sch, col;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = sch
        AND table_name = 'requests'
        AND column_name = col
        AND udt_name = 'bool'
    ) THEN
      EXECUTE format('ALTER TABLE %I.requests ALTER COLUMN %I DROP DEFAULT', sch, col);
      EXECUTE format(
        'ALTER TABLE %I.requests ALTER COLUMN %I TYPE %I.boolean_enum
         USING (
           CASE
             WHEN %I IS TRUE THEN ''true''::%I.boolean_enum
             ELSE ''false''::%I.boolean_enum
           END
         )',
        sch, col, sch, col, sch, sch
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.requests ALTER COLUMN %I SET DEFAULT ''false''::%I.boolean_enum',
      sch, col, sch
    );
    EXECUTE format('ALTER TABLE %I.requests ALTER COLUMN %I SET NOT NULL', sch, col);
    RAISE NOTICE 'Converted %.requests.% -> boolean_enum DEFAULT false', sch, col;
  END LOOP;
END $$;

-- Verify
SELECT column_name, udt_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'helloworldjunktest'
  AND table_name = 'requests'
  AND column_name IN ('interested', 'brief_paid', 'full_paid')
ORDER BY column_name;
