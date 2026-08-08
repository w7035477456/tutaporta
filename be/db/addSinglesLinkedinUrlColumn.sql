-- Store the member-entered "LinkedIn profile & URL" on singles.linkedin_url (text).
-- Run on Primary (Mac dev):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesLinkedinUrlColumn.sql

DO $$
DECLARE
  schema_name text := 'helloworldjunktest';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = schema_name AND table_name = 'singles' AND column_name = 'linkedin_url'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.singles ADD COLUMN linkedin_url text',
      schema_name
    );
  END IF;
END $$;
