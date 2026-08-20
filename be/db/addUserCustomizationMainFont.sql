-- user_customization.main_font — site “Main font for website” (profile menu).
-- Default Algerian for new rows and existing rows that still have the old Comic Neue default.

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS main_font text NOT NULL DEFAULT 'Algerian, fantasy';

COMMENT ON COLUMN helloworldjunktest.user_customization.main_font IS
  'Website main font stack (profile “Main font for website”). Default Algerian, fantasy.';

UPDATE helloworldjunktest.user_customization
SET main_font = 'Algerian, fantasy',
    updated_at = NOW()
WHERE main_font IS NULL
   OR btrim(main_font) = ''
   OR lower(replace(replace(main_font, '"', ''), '''', '')) LIKE 'comic neue%';
