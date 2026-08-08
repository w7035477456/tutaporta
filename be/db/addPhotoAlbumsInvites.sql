-- TutaPhotoAlbums album sharing (Postgres — cross-user invites + accepted shares).
-- Vault content stays in SQLite (notebooks/notes); these tables store invite metadata only.
-- Planning names: album_sets → vault notebooks, albums → vault notes, album_invites → photo_albums_invites.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addPhotoAlbumsInvites.sql

BEGIN;

CREATE TABLE IF NOT EXISTS helloworldjunktest.photo_albums_invites (
  invite_id SERIAL PRIMARY KEY,
  owner_singles_id INTEGER NOT NULL REFERENCES helloworldjunktest.singles(singles_id) ON DELETE CASCADE,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('usb', 'onedrive')),
  vault_notebook_id INTEGER NOT NULL,
  vault_note_id INTEGER NOT NULL,
  album_set_name TEXT NOT NULL DEFAULT '',
  album_name TEXT NOT NULL DEFAULT '',
  invitee_email TEXT NOT NULL,
  invitee_email_normalized TEXT NOT NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  invite_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_singles_id INTEGER REFERENCES helloworldjunktest.singles(singles_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS photo_albums_invites_token_uidx
  ON helloworldjunktest.photo_albums_invites (invite_token);

CREATE INDEX IF NOT EXISTS photo_albums_invites_owner_album_active_idx
  ON helloworldjunktest.photo_albums_invites (owner_singles_id, vault_note_id, invited_at DESC, invite_id DESC)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS photo_albums_invites_owner_album_email_active_uidx
  ON helloworldjunktest.photo_albums_invites (owner_singles_id, vault_note_id, invitee_email_normalized)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS helloworldjunktest.photo_albums_shared_albums (
  shared_album_id SERIAL PRIMARY KEY,
  invite_id INTEGER NOT NULL REFERENCES helloworldjunktest.photo_albums_invites(invite_id) ON DELETE CASCADE,
  recipient_singles_id INTEGER NOT NULL REFERENCES helloworldjunktest.singles(singles_id) ON DELETE CASCADE,
  owner_singles_id INTEGER NOT NULL REFERENCES helloworldjunktest.singles(singles_id) ON DELETE CASCADE,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('usb', 'onedrive')),
  vault_notebook_id INTEGER NOT NULL,
  vault_note_id INTEGER NOT NULL,
  album_set_name TEXT NOT NULL DEFAULT '',
  album_name TEXT NOT NULL DEFAULT '',
  display_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipient_singles_id, invite_id)
);

CREATE INDEX IF NOT EXISTS photo_albums_shared_albums_recipient_idx
  ON helloworldjunktest.photo_albums_shared_albums (recipient_singles_id, created_at DESC, shared_album_id DESC);

COMMIT;

-- Verify:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'helloworldjunktest' AND tablename LIKE 'photo_albums_%invite%';
