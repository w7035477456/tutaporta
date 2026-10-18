-- outdateddbsnapshotoct2024.singles.id_initialization_completed — mandatory first-login
-- "Initialization of ID Process" (gender → nickname/secret icon → profile photo →
-- Identification Verification consent / profile / driver license / live scan → Save).
-- false = member is locked to the onboarding flow (FE redirect + BE 403 on gated APIs).
-- true  = Identification Verification Save succeeded (set by the server only).
-- On first add: backfill DEMOUSER / REGULARMEMBER / ADMIN and anyone with vet_bio.id_verification_date.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesIdInitializationCompleted.sql
-- Prod Primary only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'id_initialization_completed'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD COLUMN id_initialization_completed boolean NOT NULL DEFAULT false;

    UPDATE outdateddbsnapshotoct2024.singles s
    SET id_initialization_completed = true
    WHERE UPPER(BTRIM(COALESCE(s.member_category::text, ''))) IN ('DEMOUSER', 'REGULARMEMBER', 'ADMIN')
       OR EXISTS (
         SELECT 1
         FROM outdateddbsnapshotoct2024.vet_bio v
         WHERE v.singles_id = s.singles_id
           AND v.id_verification_date IS NOT NULL
       );
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.id_initialization_completed IS
  'false = must finish mandatory first-login ID initialization (redirect to Self-Report-Bio IDV); true = completed.';
