-- All Singles welcome banner expand/collapse — per user in user_customization.
-- Run on Primary: psql -h ... -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationAllSinglesWelcomeExpanded.sql

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS all_singles_welcome_expanded helloworldjunktest.boolean_enum NOT NULL DEFAULT 'true'::helloworldjunktest.boolean_enum;

COMMENT ON COLUMN helloworldjunktest.user_customization.all_singles_welcome_expanded IS
  'All Singles page welcome panel: true = expanded, false = collapsed (user_customization).';
