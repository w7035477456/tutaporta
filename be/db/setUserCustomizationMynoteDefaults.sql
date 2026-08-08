-- Set Postgres DEFAULTs for myNote prefs and backfill existing NULL rows.
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/setUserCustomizationMynoteDefaults.sql

ALTER TABLE helloworldjunktest.user_customization
  ALTER COLUMN mynote_font_color_index SET DEFAULT 0,
  ALTER COLUMN mynote_content_bg_index SET DEFAULT 1,
  ALTER COLUMN mynote_text_highlight_index SET DEFAULT NULL,
  ALTER COLUMN mynote_font_size SET DEFAULT 20,
  ALTER COLUMN mynote_editor_font_size_pt SET DEFAULT 20;

-- Keep legacy alias column in sync if present (older migrations).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'user_customization'
      AND column_name = 'mynote_editor_font_size'
  ) THEN
    EXECUTE 'ALTER TABLE helloworldjunktest.user_customization ALTER COLUMN mynote_editor_font_size SET DEFAULT 20';
  END IF;
END $$;

COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_font_color_index IS
  'Note typing font color swatch index 0–6; DEFAULT 0 (black).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_content_bg_index IS
  'Note panel background swatch index 0–6; DEFAULT 1 (white).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_text_highlight_index IS
  'Note text highlight / text-bg swatch index 0–6; NULL = none (avoid white box around typed text).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_font_size IS
  'myNote button label font size in tenths of rem; DEFAULT 20 (2.0 rem).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_editor_font_size_pt IS
  'Last editor font size in points (toolbar); DEFAULT 20.';

UPDATE helloworldjunktest.user_customization
SET
  mynote_font_color_index = COALESCE(mynote_font_color_index, 0),
  mynote_content_bg_index = COALESCE(mynote_content_bg_index, 1),
  -- Clear legacy white (1) text-highlight default that looked like an input box.
  mynote_text_highlight_index = CASE
    WHEN mynote_text_highlight_index = 1 THEN NULL
    ELSE mynote_text_highlight_index
  END,
  mynote_font_size = COALESCE(mynote_font_size, 20),
  mynote_editor_font_size_pt = COALESCE(mynote_editor_font_size_pt, 20),
  updated_at = NOW()
WHERE mynote_font_color_index IS NULL
   OR mynote_content_bg_index IS NULL
   OR mynote_text_highlight_index = 1
   OR mynote_font_size IS NULL
   OR mynote_editor_font_size_pt IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'user_customization'
      AND column_name = 'mynote_editor_font_size'
  ) THEN
    EXECUTE $q$
      UPDATE helloworldjunktest.user_customization
      SET mynote_editor_font_size = COALESCE(mynote_editor_font_size, mynote_editor_font_size_pt, 20),
          updated_at = NOW()
      WHERE mynote_editor_font_size IS NULL
    $q$;
  END IF;
END $$;
