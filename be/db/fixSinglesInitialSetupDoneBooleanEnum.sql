-- singles.initial_setup_done: convert legacy boolean → boolean_enum (required for profile photo / preferences).
-- Run on Primary. Safe to re-run (no-op when already boolean_enum).

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
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'initial_setup_done'
      AND udt_name = 'bool'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ALTER COLUMN initial_setup_done DROP DEFAULT;
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ALTER COLUMN initial_setup_done TYPE outdateddbsnapshotoct2024.boolean_enum
      USING (
        CASE
          WHEN initial_setup_done IS TRUE THEN 'true'::outdateddbsnapshotoct2024.boolean_enum
          ELSE 'false'::outdateddbsnapshotoct2024.boolean_enum
        END
      );
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ALTER COLUMN initial_setup_done SET DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum;
  END IF;
END
$$;
