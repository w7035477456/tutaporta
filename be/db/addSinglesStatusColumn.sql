-- helloworldjunktest.singles.status — account status enum (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesStatusColumn.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'singles_status'
  ) THEN
    CREATE TYPE helloworldjunktest.singles_status AS ENUM (
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

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS status helloworldjunktest.singles_status NOT NULL
  DEFAULT 'blank'::helloworldjunktest.singles_status;

COMMENT ON COLUMN helloworldjunktest.singles.status IS
  'Account status (singles_status enum). Default blank until set.';
