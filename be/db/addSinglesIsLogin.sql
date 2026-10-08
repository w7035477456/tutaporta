-- outdateddbsnapshotoct2024.singles.is_login — backend gatekeeper session flag (Primary only).
-- true while user has an active server-side login; false after idle logout or explicit logout.

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

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS is_login outdateddbsnapshotoct2024.boolean_enum NOT NULL
  DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.is_login IS
  'Backend gatekeeper: true while session is active (login / API activity). Idle logout sets false.';
