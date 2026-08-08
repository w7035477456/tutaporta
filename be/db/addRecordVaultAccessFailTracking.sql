-- Durable, per-backend vault-password failure tracking (TutaNotes notes_vault).
-- Mac:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite \
--   -f be/db/addRecordVaultAccessFailTracking.sql
--
-- Supports both legacy record_vault and renamed notes_vault.

BEGIN;

DO $$
DECLARE
  t regclass := COALESCE(
    to_regclass('helloworldjunktest.notes_vault'),
    to_regclass('helloworldjunktest.record_vault')
  );
BEGIN
  IF t IS NULL THEN
    RAISE EXCEPTION 'notes_vault / record_vault table not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE %s
       ADD COLUMN IF NOT EXISTS access_failed_attempts integer NOT NULL DEFAULT 0,
       ADD COLUMN IF NOT EXISTS access_locked_until timestamp with time zone',
    t
  );

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname IN (
             'notes_vault_access_failed_attempts_chk',
             'record_vault_access_failed_attempts_chk'
           )
       AND conrelid = t
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s
         ADD CONSTRAINT notes_vault_access_failed_attempts_chk
         CHECK (access_failed_attempts >= 0)',
      t
    );
  END IF;

  EXECUTE format(
    'COMMENT ON COLUMN %s.access_failed_attempts IS %L',
    t,
    'Consecutive incorrect vault-password attempts for this storage backend.'
  );
  EXECUTE format(
    'COMMENT ON COLUMN %s.access_locked_until IS %L',
    t,
    'Timestamp before which another vault-password attempt is prohibited.'
  );
END
$$;

COMMIT;
