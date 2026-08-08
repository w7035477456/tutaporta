-- user_customization.mynote_font_size — myNote button font size in tenths of rem (20 = 2.0 rem).
-- Run on Primary.

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS mynote_font_size smallint NULL;

COMMENT ON COLUMN helloworldjunktest.user_customization.mynote_font_size IS
  'myNote button label font size in tenths of rem; NULL = app default 20 (2.0 rem).';

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_mynote_font_size_range_chk;

ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_mynote_font_size_range_chk
  CHECK (mynote_font_size IS NULL OR (mynote_font_size >= 5 AND mynote_font_size <= 80));
