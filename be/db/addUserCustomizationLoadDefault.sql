-- user_customization.load_default — one-time auto "Load Default" for Embedded Youtube Player.
-- Existing rows: true (do not overwrite their slots). New rows: false until first Track open loads globals.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addUserCustomizationLoadDefault.sql

BEGIN;

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS load_default boolean NOT NULL DEFAULT true;

ALTER TABLE helloworldjunktest.user_customization
  ALTER COLUMN load_default SET DEFAULT false;

COMMENT ON COLUMN helloworldjunktest.user_customization.load_default IS
  'When false, opening Track auto-applies global.default_music_url once, then sets true.';

COMMIT;

-- Verify: SELECT load_default, COUNT(*) FROM helloworldjunktest.user_customization GROUP BY 1;
