-- outdateddbsnapshotoct2024.requests block_user (run on Primary only)
-- Prefer be/db/migrateAllBooleanEnumColumns.sql for full boolean_enum migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'boolean_enum'
  ) THEN
    CREATE TYPE outdateddbsnapshotoct2024.boolean_enum AS ENUM ('true', 'false');
  END IF;
END $$;

ALTER TABLE outdateddbsnapshotoct2024.requests
  ADD COLUMN IF NOT EXISTS block_user outdateddbsnapshotoct2024.boolean_enum NOT NULL
  DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum;
