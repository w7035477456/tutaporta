-- LinkedIn Search verification (Step 4) on vet_bio.
-- Run on Primary (Mac dev):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addVetBioLinkedInVerificationColumns.sql

DO $$
DECLARE
  schema_name text := 'helloworldjunktest';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name AND table_name = 'vet_bio' AND column_name = 'linkedin_verification'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.vet_bio ADD COLUMN linkedin_verification varchar(32) DEFAULT ''notstarted''',
      schema_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name AND table_name = 'vet_bio' AND column_name = 'linkedin_verification_date'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.vet_bio ADD COLUMN linkedin_verification_date timestamptz',
      schema_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name AND table_name = 'vet_bio' AND column_name = 'linkedin_member_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.vet_bio ADD COLUMN linkedin_member_id varchar(64)',
      schema_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name AND table_name = 'vet_bio' AND column_name = 'linkedin_profile_json'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.vet_bio ADD COLUMN linkedin_profile_json text',
      schema_name
    );
  END IF;
END $$;
