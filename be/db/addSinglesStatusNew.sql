-- outdateddbsnapshotoct2024.singles_status: new — registration finished, Driver License / Passport
-- scan not done yet. The ID scan moves new → active (age ≥ 18) or under18.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesStatusNew.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/addSinglesStatusNew.sql
-- Prod Primary only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'singles_status'
      AND e.enumlabel = 'new'
  ) THEN
    ALTER TYPE outdateddbsnapshotoct2024.singles_status ADD VALUE 'new';
  END IF;
END $$;

COMMENT ON TYPE outdateddbsnapshotoct2024.singles_status IS
  'Account status. new = registered, ID scan pending (TutaDates blocked; TutaNotes/TutaPhotos allowed). '
  'under18 = government ID OCR age under 18; login blocked.';
