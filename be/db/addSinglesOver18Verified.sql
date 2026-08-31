-- helloworldjunktest.singles.over_18_verified — age gate from government ID DOB OCR.
-- NULL = not yet verified (force Identification Verification).
-- true = DOB confirms age >= 18.
-- false = DOB confirms under 18 (pair with status = under18).
-- On first add: backfill existing rows to true. New signups keep DEFAULT NULL.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesOver18Verified.sql
-- Prod Primary only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'over_18_verified'
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      ADD COLUMN over_18_verified boolean DEFAULT NULL;

    UPDATE helloworldjunktest.singles
    SET over_18_verified = true
    WHERE over_18_verified IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.singles.over_18_verified IS
  'NULL = pending ID DOB age check; true = verified >= 18; false = under 18 (login blocked via status=under18).';
