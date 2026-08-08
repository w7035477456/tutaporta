-- helloworldjunktest.requests block_user (run on Primary only)
-- Prefer be/db/migrateAllBooleanEnumColumns.sql for full boolean_enum migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'boolean_enum'
  ) THEN
    CREATE TYPE helloworldjunktest.boolean_enum AS ENUM ('true', 'false');
  END IF;
END $$;

ALTER TABLE helloworldjunktest.requests
  ADD COLUMN IF NOT EXISTS block_user helloworldjunktest.boolean_enum NOT NULL
  DEFAULT 'false'::helloworldjunktest.boolean_enum;
