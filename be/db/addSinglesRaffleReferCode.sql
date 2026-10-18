-- Permanent 4-digit Friend Refer Code per member, shown in red on every raffle ticket.
ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS raffle_refer_code varchar(4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'singles_raffle_refer_code_format'
       AND conrelid = 'outdateddbsnapshotoct2024.singles'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD CONSTRAINT singles_raffle_refer_code_format CHECK (raffle_refer_code ~ '^[0-9]{4}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS singles_raffle_refer_code_uniq
  ON outdateddbsnapshotoct2024.singles (raffle_refer_code)
  WHERE raffle_refer_code IS NOT NULL;

-- Backfill existing members with a random unused code (1000–9999, no leading zero).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT singles_id FROM outdateddbsnapshotoct2024.singles WHERE raffle_refer_code IS NULL ORDER BY singles_id LOOP
    UPDATE outdateddbsnapshotoct2024.singles
       SET raffle_refer_code = (
         SELECT n::text FROM generate_series(1000, 9999) AS n
          WHERE NOT EXISTS (
            SELECT 1 FROM outdateddbsnapshotoct2024.singles t WHERE t.raffle_refer_code = n::text
          )
          ORDER BY random()
          LIMIT 1
       )
     WHERE singles_id = r.singles_id;
  END LOOP;
END $$;
