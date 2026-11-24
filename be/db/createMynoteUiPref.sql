-- mynote_ui_pref — per-user TutaNotes UI preferences that are not part of user_customization.
-- list_font_pct: Font + / − scale (percent) for the Notebook / Note / Shortcut / Recent list labels.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createMynoteUiPref.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/createMynoteUiPref.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.mynote_ui_pref (
  singles_id bigint PRIMARY KEY
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  list_font_pct smallint NOT NULL DEFAULT 100
    CHECK (list_font_pct >= 50 AND list_font_pct <= 250),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN outdateddbsnapshotoct2024.mynote_ui_pref.list_font_pct IS
  'Font +/- scale (%) for TutaNotes Notebook / Note / Shortcut / Recent list labels. 100 = default.';
