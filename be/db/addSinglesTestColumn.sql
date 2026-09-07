-- Add optional boolean test flag on singles.
-- Run on Primary: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesTestColumn.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN helloworldjunktest.singles.test IS
  'Scratch / test boolean column.';

COMMIT;
