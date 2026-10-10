-- user_customization.load_default — one-time auto "Load Default" for Embedded Youtube Player.
-- Existing rows: true (do not overwrite their slots). New rows: false until first Track open loads globals.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addUserCustomizationLoadDefault.sql

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ADD COLUMN IF NOT EXISTS load_default boolean NOT NULL DEFAULT true;

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ALTER COLUMN load_default SET DEFAULT false;

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.load_default IS
  'When false, opening Track auto-applies global.default_music_url once, then sets true.';

COMMIT;

-- Verify: SELECT load_default, COUNT(*) FROM outdateddbsnapshotoct2024.user_customization GROUP BY 1;
