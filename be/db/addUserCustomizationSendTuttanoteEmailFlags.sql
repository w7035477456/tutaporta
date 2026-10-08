-- Bill Schedule email prefs on user_customization (TutaNotes Monthly + Yearly share these).
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationSendTuttanoteEmailFlags.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'boolean_enum'
  ) THEN
    CREATE TYPE outdateddbsnapshotoct2024.boolean_enum AS ENUM ('true', 'false');
  END IF;
END
$$;

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ADD COLUMN IF NOT EXISTS send_tuttanote_overdue outdateddbsnapshotoct2024.boolean_enum NOT NULL
    DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum,
  ADD COLUMN IF NOT EXISTS send_tuttanote_1dayahead outdateddbsnapshotoct2024.boolean_enum NOT NULL
    DEFAULT 'false'::outdateddbsnapshotoct2024.boolean_enum;

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.send_tuttanote_overdue IS
  'Bill Schedule: when true, email digest of overdue Manual bills (default false).';

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.send_tuttanote_1dayahead IS
  'Bill Schedule: when true, email digest of Manual bills due tomorrow (default false).';

-- Optional counts on existing daily log (ahead section of same digest).
ALTER TABLE outdateddbsnapshotoct2024.bill_overdue_email_log
  ADD COLUMN IF NOT EXISTS monthly_ahead_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_ahead_count integer NOT NULL DEFAULT 0;
