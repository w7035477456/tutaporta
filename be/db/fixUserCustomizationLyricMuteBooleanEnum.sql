-- user_customization.lyric_mute: convert legacy boolean → boolean_enum (required for PUT /api/user/customization).
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
      AND table_name = 'user_customization'
      AND column_name = 'lyric_mute'
      AND udt_name = 'bool'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.user_customization
      ALTER COLUMN lyric_mute DROP DEFAULT;
    ALTER TABLE outdateddbsnapshotoct2024.user_customization
      ALTER COLUMN lyric_mute TYPE outdateddbsnapshotoct2024.boolean_enum
      USING (
        CASE
          WHEN lyric_mute IS TRUE THEN 'true'::outdateddbsnapshotoct2024.boolean_enum
          ELSE 'false'::outdateddbsnapshotoct2024.boolean_enum
        END
      );
    ALTER TABLE outdateddbsnapshotoct2024.user_customization
      ALTER COLUMN lyric_mute SET DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum;
    ALTER TABLE outdateddbsnapshotoct2024.user_customization
      ALTER COLUMN lyric_mute SET NOT NULL;
  END IF;
END
$$;
