-- Default theme for NEW singles rows when INSERT omits theme.
-- Does not change existing members' theme preferences.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/setSinglesThemeDefaultOceanDark.sql
-- Ubuntu:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/setSinglesThemeDefaultOceanDark.sql

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN theme SET DEFAULT 'ocean dark';

COMMENT ON COLUMN helloworldjunktest.singles.theme IS
  'Profile color theme display name (case-insensitive match to FE theme rows). New accounts default to ocean dark.';

-- Verify:
-- SELECT column_default FROM information_schema.columns
-- WHERE table_schema = 'helloworldjunktest' AND table_name = 'singles' AND column_name = 'theme';
