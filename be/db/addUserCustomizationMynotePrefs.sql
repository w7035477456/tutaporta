-- myNote editor preferences (last note, colors, font size, scroll) — per user in user_customization.
-- Run on Primary: psql -h ... -U test_user1 -d vsingles -f be/db/addUserCustomizationMynotePrefs.sql

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS mynote_last_notebook_id bigint NULL,
  ADD COLUMN IF NOT EXISTS mynote_last_note_id bigint NULL,
  ADD COLUMN IF NOT EXISTS mynote_content_bg_index smallint NULL,
  ADD COLUMN IF NOT EXISTS mynote_font_color_index smallint NULL,
  ADD COLUMN IF NOT EXISTS mynote_text_highlight_index smallint NULL,
  ADD COLUMN IF NOT EXISTS mynote_editor_font_size smallint NULL,
  ADD COLUMN IF NOT EXISTS mynote_note_scroll_top integer NULL,
  ADD COLUMN IF NOT EXISTS mynote_editor_caret_pos integer NULL;

COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_last_notebook_id IS
  'Last Record Vault notebook_id the user had open (vault USB DB id, not FK).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_last_note_id IS
  'Last Record Vault note_id within mynote_last_notebook_id.';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_content_bg_index IS
  'Note panel background swatch index 0–6; NULL = app default white (1).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_font_color_index IS
  'Note typing font color swatch index 0–6; NULL = app default black (0).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_text_highlight_index IS
  'Note text highlight / text-bg swatch index 0–6; NULL = app default white (1).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_editor_font_size IS
  'Last editor font size in points (toolbar); NULL = app default 20. Not mynote_font_size (menu button rem).';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_note_scroll_top IS
  'Scroll position (px) in the note content column when user left myNote.';
COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_editor_caret_pos IS
  'TipTap / ProseMirror document position for caret restore; optional.';

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_mynote_color_index_range_chk;
ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_mynote_color_index_range_chk
  CHECK (
    (mynote_content_bg_index IS NULL OR (mynote_content_bg_index >= 0 AND mynote_content_bg_index <= 6))
    AND (mynote_font_color_index IS NULL OR (mynote_font_color_index >= 0 AND mynote_font_color_index <= 6))
    AND (mynote_text_highlight_index IS NULL OR (mynote_text_highlight_index >= 0 AND mynote_text_highlight_index <= 6))
  );

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_mynote_editor_font_size_range_chk;
ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_mynote_editor_font_size_range_chk
  CHECK (mynote_editor_font_size IS NULL OR (mynote_editor_font_size >= 4 AND mynote_editor_font_size <= 128));

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_mynote_note_scroll_top_range_chk;
ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_mynote_note_scroll_top_range_chk
  CHECK (mynote_note_scroll_top IS NULL OR mynote_note_scroll_top >= 0);

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_mynote_editor_caret_pos_range_chk;
ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_mynote_editor_caret_pos_range_chk
  CHECK (mynote_editor_caret_pos IS NULL OR mynote_editor_caret_pos >= 0);
