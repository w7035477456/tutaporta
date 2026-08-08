-- helloworldjunktest.singles.phone — E.164 format check (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesValidE164PhoneConstraint.sql

DO $$
DECLARE
  invalid RECORD;
BEGIN
  FOR invalid IN
    SELECT singles_id, phone
    FROM helloworldjunktest.singles
    WHERE phone IS NULL
       OR btrim(phone) = ''
       OR phone !~ '^\+[1-9]\d{6,14}$'
  LOOP
    RAISE EXCEPTION 'Cannot add valid_e164_phone: singles_id % has invalid phone %', invalid.singles_id, invalid.phone;
  END LOOP;
END $$;

ALTER TABLE helloworldjunktest.singles
  DROP CONSTRAINT IF EXISTS valid_e164_phone;

ALTER TABLE helloworldjunktest.singles
  ADD CONSTRAINT valid_e164_phone CHECK (phone ~ '^\+[1-9]\d{6,14}$');
