-- Default theme for NEW singles rows when INSERT omits theme.
-- Does not change existing members' theme preferences.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/setSinglesThemeDefaultOceanDark.sql
-- Ubuntu:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/setSinglesThemeDefaultOceanDark.sql

ALTER TABLE outdateddbsnapshotoct2024.singles
  ALTER COLUMN theme SET DEFAULT 'ocean dark';

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.theme IS
  'Profile color theme display name (case-insensitive match to FE theme rows). New accounts default to ocean dark.';

-- Verify:
-- SELECT column_default FROM information_schema.columns
-- WHERE table_schema = 'outdateddbsnapshotoct2024' AND table_name = 'singles' AND column_name = 'theme';
