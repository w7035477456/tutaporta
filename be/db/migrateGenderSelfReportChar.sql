-- Rename gender_self_report_male (boolean) → gender_self_report CHAR(1)
-- true → 'M', false → 'F', NULL stays NULL.
ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS gender_self_report char(1);

UPDATE helloworldjunktest.singles
SET gender_self_report = CASE
  WHEN gender_self_report_male IS TRUE THEN 'M'
  WHEN gender_self_report_male IS FALSE THEN 'F'
  ELSE NULL
END
WHERE gender_self_report IS NULL
   OR gender_self_report_male IS NOT NULL;

ALTER TABLE helloworldjunktest.singles
  DROP COLUMN IF EXISTS gender_self_report_male;

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN gender_self_report TYPE char(1);

ALTER TABLE helloworldjunktest.singles
  DROP CONSTRAINT IF EXISTS singles_gender_self_report_check;

ALTER TABLE helloworldjunktest.singles
  ADD CONSTRAINT singles_gender_self_report_check
  CHECK (gender_self_report IS NULL OR gender_self_report IN ('M', 'F'));

COMMENT ON COLUMN helloworldjunktest.singles.gender_self_report IS
  'Self-reported gender for demo-buddy seeding: M=male, F=female, NULL=not answered';
