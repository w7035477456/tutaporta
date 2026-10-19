-- Refer codes get a letter prefix + 4 digits (Primary only; safe to re-run):
--   Signup refer code  singles.my_refer_code / refer_by_code            → A#### (unique; A0000 = no referrer)
--   Raffle refer code  singles.raffle_refer_code / raffle_refer_by_code,
--                      raffle_refer_pending.raffle_refer_code            → R#### (digits kept)
-- Old 6-digit my_refer_code values are replaced with random unused A1000–A9999; refer_by_code follows
-- the referrer's new code (123456 → A0000).

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.singles
  DROP CONSTRAINT IF EXISTS singles_refer_by_code_six_digits_chk,
  DROP CONSTRAINT IF EXISTS singles_refer_code_six_digits_chk,
  DROP CONSTRAINT IF EXISTS singles_raffle_refer_code_format,
  DROP CONSTRAINT IF EXISTS singles_raffle_refer_by_code_format,
  DROP CONSTRAINT IF EXISTS singles_my_refer_code_format,
  DROP CONSTRAINT IF EXISTS singles_refer_by_code_format;

ALTER TABLE outdateddbsnapshotoct2024.raffle_refer_pending
  DROP CONSTRAINT IF EXISTS raffle_refer_pending_raffle_refer_code_check;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN my_refer_code TYPE varchar(6) USING btrim(my_refer_code),
  ALTER COLUMN refer_by_code TYPE varchar(6) USING btrim(refer_by_code),
  ALTER COLUMN raffle_refer_code TYPE varchar(5),
  ALTER COLUMN raffle_refer_by_code TYPE varchar(5);

ALTER TABLE outdateddbsnapshotoct2024.raffle_refer_pending
  ALTER COLUMN raffle_refer_code TYPE varchar(5);

-- Raffle: R + existing digits.
UPDATE outdateddbsnapshotoct2024.singles SET raffle_refer_code = 'R' || raffle_refer_code
 WHERE raffle_refer_code ~ '^[0-9]{4}$';
UPDATE outdateddbsnapshotoct2024.singles SET raffle_refer_by_code = 'R' || raffle_refer_by_code
 WHERE raffle_refer_by_code ~ '^[0-9]{4}$';
UPDATE outdateddbsnapshotoct2024.raffle_refer_pending SET raffle_refer_code = 'R' || raffle_refer_code
 WHERE raffle_refer_code ~ '^[0-9]{4}$';

-- Signup: unique random A#### per member that still has a 6-digit code.
CREATE TEMP TABLE refer_code_map ON COMMIT DROP AS
WITH used AS (
  SELECT my_refer_code AS code FROM outdateddbsnapshotoct2024.singles WHERE my_refer_code ~ '^A[0-9]{4}$'
),
pool AS (
  SELECT 'A' || n AS code, row_number() OVER (ORDER BY random()) AS rn
    FROM generate_series(1000, 9999) AS n
   WHERE NOT EXISTS (SELECT 1 FROM used WHERE used.code = 'A' || n)
),
old AS (
  SELECT singles_id, my_refer_code AS old_code, row_number() OVER (ORDER BY singles_id) AS rn
    FROM outdateddbsnapshotoct2024.singles
   WHERE my_refer_code ~ '^[0-9]{6}$'
)
SELECT old.singles_id, old.old_code, pool.code AS new_code
  FROM old JOIN pool USING (rn);

UPDATE outdateddbsnapshotoct2024.singles r
   SET refer_by_code = CASE
         WHEN r.refer_by_code = '123456' THEN 'A0000'
         ELSE COALESCE(
           (SELECT m.new_code FROM refer_code_map m WHERE m.old_code = r.refer_by_code ORDER BY m.singles_id LIMIT 1),
           'A0000')
       END
 WHERE r.refer_by_code ~ '^[0-9]{6}$';

UPDATE outdateddbsnapshotoct2024.singles s
   SET my_refer_code = m.new_code
  FROM refer_code_map m
 WHERE m.singles_id = s.singles_id;

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN my_refer_code TYPE varchar(5),
  ALTER COLUMN refer_by_code TYPE varchar(5);

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD CONSTRAINT singles_my_refer_code_format CHECK (my_refer_code IS NULL OR my_refer_code ~ '^A[0-9]{4}$'),
  ADD CONSTRAINT singles_refer_by_code_format CHECK (refer_by_code IS NULL OR refer_by_code ~ '^A[0-9]{4}$'),
  ADD CONSTRAINT singles_raffle_refer_code_format CHECK (raffle_refer_code IS NULL OR raffle_refer_code ~ '^R[0-9]{4}$'),
  ADD CONSTRAINT singles_raffle_refer_by_code_format
    CHECK (raffle_refer_by_code IS NULL OR raffle_refer_by_code ~ '^R[0-9]{4}$');

ALTER TABLE outdateddbsnapshotoct2024.raffle_refer_pending
  ADD CONSTRAINT raffle_refer_pending_raffle_refer_code_check CHECK (raffle_refer_code ~ '^R[0-9]{4}$');

CREATE UNIQUE INDEX IF NOT EXISTS singles_my_refer_code_uniq
  ON outdateddbsnapshotoct2024.singles (my_refer_code)
  WHERE my_refer_code IS NOT NULL;

COMMIT;
