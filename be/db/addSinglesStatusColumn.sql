-- outdateddbsnapshotoct2024.singles.status — account status enum (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesStatusColumn.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'singles_status'
  ) THEN
    CREATE TYPE outdateddbsnapshotoct2024.singles_status AS ENUM (
      'active',
      'cancel',
      'suspend',
      'pause',
      'abandon',
      'unknown',
      'other',
      'blank'
    );
  END IF;
END $$;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS status outdateddbsnapshotoct2024.singles_status NOT NULL
  DEFAULT 'blank'::outdateddbsnapshotoct2024.singles_status;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.status IS
  'Account status (singles_status enum). Default blank until set.';
