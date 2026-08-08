-- Cascade / nullify photo_albums invite FKs so admin Cascade Delete of singles works.
-- owner / recipient / invite_id → ON DELETE CASCADE
-- accepted_by_singles_id → ON DELETE SET NULL (keep owner's invite when acceptor is wiped)
--
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addPhotoAlbumsInvitesSinglesCascadeDelete.sql

BEGIN;

-- Shared albums must drop when their invite is removed (owner cascade deletes invites).
ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  DROP CONSTRAINT IF EXISTS photo_albums_shared_albums_invite_id_fkey;
ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  ADD CONSTRAINT photo_albums_shared_albums_invite_id_fkey
  FOREIGN KEY (invite_id) REFERENCES helloworldjunktest.photo_albums_invites (invite_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  DROP CONSTRAINT IF EXISTS photo_albums_shared_albums_owner_singles_id_fkey;
ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  ADD CONSTRAINT photo_albums_shared_albums_owner_singles_id_fkey
  FOREIGN KEY (owner_singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  DROP CONSTRAINT IF EXISTS photo_albums_shared_albums_recipient_singles_id_fkey;
ALTER TABLE helloworldjunktest.photo_albums_shared_albums
  ADD CONSTRAINT photo_albums_shared_albums_recipient_singles_id_fkey
  FOREIGN KEY (recipient_singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.photo_albums_invites
  DROP CONSTRAINT IF EXISTS photo_albums_invites_owner_singles_id_fkey;
ALTER TABLE helloworldjunktest.photo_albums_invites
  ADD CONSTRAINT photo_albums_invites_owner_singles_id_fkey
  FOREIGN KEY (owner_singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.photo_albums_invites
  DROP CONSTRAINT IF EXISTS photo_albums_invites_accepted_by_singles_id_fkey;
ALTER TABLE helloworldjunktest.photo_albums_invites
  ADD CONSTRAINT photo_albums_invites_accepted_by_singles_id_fkey
  FOREIGN KEY (accepted_by_singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE SET NULL;

COMMIT;
