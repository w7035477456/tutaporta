-- Un-pin myNote button font size for members who never chose one.
--
-- History: an earlier backfill (be/db/setUserCustomizationMynoteDefaults.sql)
-- wrote COALESCE(mynote_font_size, 20) into every row, and the API substituted 20
-- on read. That baked "20 tenths = 2.0rem" into the table, so the browser could
-- never fall back to DESKTOP_FONT_SIZE_BUTTON — the myNote header/notebook buttons
-- stayed at 2rem while the rest of the app used 1vw. Result: blue box too large.
--
-- The API now returns NULL when the member has not chosen a size, and the browser
-- uses the live DESKTOP_FONT_SIZE_BUTTON default. This migration clears the
-- values that the old code wrote on the member's behalf.
--
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/unpinMynoteFontSizeDefault.sql
--
-- Safe to re-run.

ALTER TABLE outdateddbsnapshotoct2024.user_customization
  ALTER COLUMN mynote_font_size SET DEFAULT NULL;

-- Only the exact legacy default (20) is cleared: any other value is a real choice
-- made with the yellow font slider, and is left untouched.
UPDATE outdateddbsnapshotoct2024.user_customization
SET mynote_font_size = NULL,
    updated_at = NOW()
WHERE mynote_font_size = 20;

COMMENT ON COLUMN outdateddbsnapshotoct2024.user_customization.mynote_font_size IS
  'myNote menu button font size in tenths of rem (20 = 2.0rem). NULL = member never chose one → browser uses DESKTOP_FONT_SIZE_BUTTON.';
