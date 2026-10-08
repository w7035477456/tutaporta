-- All Singles welcome banner expand/collapse — per user in user_customization.
-- Run on Primary: psql -h ... -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationAllSinglesWelcomeExpanded.sql

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ADD COLUMN IF NOT EXISTS all_singles_welcome_expanded outdateddbsnapshotoct2024.boolean_enum NOT NULL DEFAULT 'true'::outdateddbsnapshotoct2024.boolean_enum;

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.all_singles_welcome_expanded IS
  'All Singles page welcome panel: true = expanded, false = collapsed (user_customization).';
