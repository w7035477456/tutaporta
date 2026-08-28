export const VAULT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS notebooks (
  notebook_id INTEGER PRIMARY KEY,
  notebook_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  note_id INTEGER PRIMARY KEY,
  notebook_id INTEGER NOT NULL,
  note_name TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  image_file_name TEXT,
  image_file_extension TEXT DEFAULT 'jpg',
  image_relative_path TEXT,
  image_checksum TEXT,
  image_file_size_bytes INTEGER,
  image_top_file_name TEXT,
  image_top_file_extension TEXT,
  image_top_relative_path TEXT,
  image_top_checksum TEXT,
  image_top_file_size_bytes INTEGER,
  image_bottom_file_name TEXT,
  image_bottom_file_extension TEXT,
  image_bottom_relative_path TEXT,
  image_bottom_checksum TEXT,
  image_bottom_file_size_bytes INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  search_text TEXT NOT NULL DEFAULT '',
  inner_encrypt_enabled INTEGER NOT NULL DEFAULT 0,
  -- Legacy v1 only; v2 E2E embeds salt+wrapped DEK in body_text. Never stores the PIN.
  inner_pin_salt TEXT,
  inner_unlock_locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS note_keywords (
  note_keyword_id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  keyword_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(note_id, keyword_normalized)
);

CREATE TABLE IF NOT EXISTS shortcuts (
  shortcut_id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('notebook', 'note')),
  notebook_id INTEGER NOT NULL,
  note_id INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_attachments (
  attachment_id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  mime_type TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  album_photo_seq INTEGER,
  source_taken_at_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note_active
  ON note_attachments(note_id, display_order, attachment_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS note_extra_images (
  image_id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL,
  file_name TEXT,
  file_extension TEXT NOT NULL DEFAULT 'jpg',
  relative_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_extra_images_note_active
  ON note_extra_images(note_id, display_order, image_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photoalbums_notebook_active_order
  ON notes(notebook_id, display_order, note_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_note_keywords_normalized ON note_keywords(keyword_normalized);
CREATE INDEX IF NOT EXISTS idx_photoalbums_search_text ON notes(search_text);
`;

/** Migration for vaults created before unlimited inline photos — run explicitly on unlock. */
export const NOTE_EXTRA_IMAGES_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS note_extra_images (
  image_id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL,
  file_name TEXT,
  file_extension TEXT NOT NULL DEFAULT 'jpg',
  relative_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_extra_images_note_active
  ON note_extra_images(note_id, display_order, image_id)
  WHERE deleted_at IS NULL;
`;

/** Migration for optional per-note inner PIN encryption (Argon2id + AES-GCM in FE). */
export const NOTE_INNER_ENCRYPT_MIGRATION_SQL = `
ALTER TABLE notes ADD COLUMN inner_encrypt_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN inner_pin_salt TEXT;
ALTER TABLE notes ADD COLUMN inner_unlock_locked_until TEXT;
`;

export const DEFAULT_BODY_TEXT = '';
/** Fresh vault: one starter album-set (Sample Set). */
export const DEFAULT_NOTEBOOKS = ['SAMPLE SET'];
/** Starter album count inside the default set. */
export const DEFAULT_NOTES_PER_NOTEBOOK = 1;
export const DEFAULT_SAMPLE_NOTEBOOK_NAME = 'SAMPLE SET';
export const DEFAULT_SAMPLE_ALBUM_NAME = 'SAMPLE ALBUM';
