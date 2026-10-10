-- Rename app schema helloworldjunktest → outdateddbsnapshotoct2024 (Mac + Ubuntu). Safe to re-run.
-- Run on Primary only, in the same window as deploying code that uses the new name.
--
-- Mac:    psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -f be/db/renameSchemaToOutdatedDbSnapshotOct2024.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/renameSchemaToOutdatedDbSnapshotOct2024.sql   (from the Mac)
--
-- Unquoted lowercase on purpose: Postgres folds unquoted identifiers to lowercase, and the app
-- (be/db/connection.js, envConfig DB_SCHEMA) uses the lowercase name.
-- ALTER SCHEMA RENAME keeps tables, sequences, defaults, triggers and views (they reference OIDs),
-- but plpgsql function bodies are stored as text, so functions naming the old schema are recreated.

BEGIN;

DO $$
DECLARE
  fn record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'helloworldjunktest') THEN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'outdateddbsnapshotoct2024') THEN
      RAISE EXCEPTION 'Both helloworldjunktest and outdateddbsnapshotoct2024 exist — resolve manually';
    END IF;
    ALTER SCHEMA helloworldjunktest RENAME TO outdateddbsnapshotoct2024;
  END IF;

  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND (p.prosrc ILIKE '%helloworldjunktest%'
           OR array_to_string(p.proconfig, ',') ILIKE '%helloworldjunktest%')
  LOOP
    EXECUTE regexp_replace(pg_get_functiondef(fn.oid), 'helloworldjunktest', 'outdateddbsnapshotoct2024', 'gi');
  END LOOP;
END $$;

ALTER ROLE test_user1 SET search_path = outdateddbsnapshotoct2024, public;

COMMIT;
