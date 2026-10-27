-- TutaPhotoAlbums vault data in Postgres (replaces the per-member SQLite vault.db / vault.db.enc).
-- Photos, display copies, thumbnails and videos stay on disk under
--   ${LARGE_CHEAP_STORAGE_FOLDER}/users/M{member_id}/photoalbums/TutaPhotoAlbums/files/…
-- These tables hold only the album index (sets, albums, page layout, file paths).
--
-- Ids are per member: PRIMARY KEY (singles_id, <local id>). They keep the values the old SQLite
-- vault used, so relative_path (files/{notebook_id}/{note_id}/att_{attachment_id}_{seq}.jpg) and the
-- attachment ids inside notes.body_text stay valid without rewriting.
--
-- photo_albums_member_vault: one row per member whose vault folder has been loaded into Postgres
-- (vault_id = vault.meta.json vaultId). Deleting it cascades to every data table.
--
-- Run on Primary (Mac and Ubuntu):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addPhotoAlbumsVaultDataTables.sql

BEGIN;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_member_vault (
  singles_id bigint PRIMARY KEY
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  vault_id text,
  source text NOT NULL DEFAULT 'seed',
  imported_from_path text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT photo_albums_member_vault_source_check CHECK (source IN ('seed', 'import', 'restore'))
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_notebooks (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  notebook_id integer NOT NULL,
  notebook_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  PRIMARY KEY (singles_id, notebook_id)
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_notes (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  note_id integer NOT NULL,
  notebook_id integer NOT NULL,
  note_name text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  image_file_name text,
  image_file_extension text DEFAULT 'jpg',
  image_relative_path text,
  image_checksum text,
  image_file_size_bytes bigint,
  image_top_file_name text,
  image_top_file_extension text,
  image_top_relative_path text,
  image_top_checksum text,
  image_top_file_size_bytes bigint,
  image_bottom_file_name text,
  image_bottom_file_extension text,
  image_bottom_relative_path text,
  image_bottom_checksum text,
  image_bottom_file_size_bytes bigint,
  display_order integer NOT NULL DEFAULT 0,
  search_text text NOT NULL DEFAULT '',
  inner_encrypt_enabled smallint NOT NULL DEFAULT 0,
  inner_pin_salt text,
  inner_unlock_locked_until text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  PRIMARY KEY (singles_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_albums_notes_notebook_active
  ON outdateddbsnapshotoct2024.photo_albums_notes (singles_id, notebook_id, display_order, note_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_note_keywords (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  note_keyword_id integer NOT NULL,
  note_id integer NOT NULL,
  keyword text NOT NULL,
  keyword_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (singles_id, note_keyword_id),
  CONSTRAINT photo_albums_note_keywords_note_keyword_key UNIQUE (singles_id, note_id, keyword_normalized)
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_shortcuts (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  shortcut_id integer NOT NULL,
  target_type text NOT NULL,
  notebook_id integer NOT NULL,
  note_id integer,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (singles_id, shortcut_id),
  CONSTRAINT photo_albums_shortcuts_target_type_check CHECK (target_type IN ('notebook', 'note'))
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_note_attachments (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  attachment_id integer NOT NULL,
  note_id integer NOT NULL,
  file_name text NOT NULL,
  file_extension text NOT NULL,
  relative_path text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  checksum text,
  mime_type text,
  display_order integer NOT NULL DEFAULT 0,
  album_photo_seq integer,
  source_taken_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  PRIMARY KEY (singles_id, attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_albums_note_attachments_note_active
  ON outdateddbsnapshotoct2024.photo_albums_note_attachments (singles_id, note_id, display_order, attachment_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.photo_albums_note_extra_images (
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.photo_albums_member_vault (singles_id) ON DELETE CASCADE,
  image_id integer NOT NULL,
  note_id integer NOT NULL,
  file_name text,
  file_extension text NOT NULL DEFAULT 'jpg',
  relative_path text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  checksum text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  PRIMARY KEY (singles_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_albums_note_extra_images_note_active
  ON outdateddbsnapshotoct2024.photo_albums_note_extra_images (singles_id, note_id, display_order, image_id)
  WHERE deleted_at IS NULL;

COMMIT;
