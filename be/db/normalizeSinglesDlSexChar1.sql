-- Normalize singles.dl_sex to CHAR(1): 'M' | 'F' | NULL.
-- Male/M → M, Female/F → F; anything else (incl. "not found", blank) → NULL.
--
-- Mac Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/normalizeSinglesDlSexChar1.sql

BEGIN;

UPDATE helloworldjunktest.singles
SET dl_sex = CASE
  WHEN UPPER(BTRIM(COALESCE(dl_sex::text, ''))) IN ('M', 'MALE') THEN 'M'
  WHEN UPPER(BTRIM(COALESCE(dl_sex::text, ''))) IN ('F', 'FEMALE') THEN 'F'
  ELSE NULL
END;

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN dl_sex TYPE char(1)
  USING (
    CASE
      WHEN UPPER(BTRIM(COALESCE(dl_sex::text, ''))) IN ('M', 'MALE') THEN 'M'
      WHEN UPPER(BTRIM(COALESCE(dl_sex::text, ''))) IN ('F', 'FEMALE') THEN 'F'
      ELSE NULL
    END
  );

COMMENT ON COLUMN helloworldjunktest.singles.dl_sex IS
  'Sex from driver license OCR: M or F (CHAR(1)); NULL when unknown.';

COMMIT;
