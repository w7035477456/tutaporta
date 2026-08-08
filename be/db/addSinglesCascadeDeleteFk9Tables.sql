-- Cascade DELETE from helloworldjunktest.singles.singles_id to 9 child tables.
-- Already CASCADE (no change): postings, user_activity_sessions, misc_bio, vet_bio.
-- Adds FK + CASCADE: audit_registrations, mobile_photo_upload_sessions, photos,
--   requests (singles_id_from + singles_id_to), user_customization.
--
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesCascadeDeleteFk9Tables.sql

BEGIN;

-- Orphan cleanup (required before FK can be enforced).
UPDATE helloworldjunktest.audit_registrations ar
SET singles_id = NULL
WHERE ar.singles_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = ar.singles_id
  );

DELETE FROM helloworldjunktest.mobile_photo_upload_sessions m
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = m.singles_id
);

DELETE FROM helloworldjunktest.photos p
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = p.singles_id
);

DELETE FROM helloworldjunktest.requests r
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = r.singles_id_from
)
OR NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = r.singles_id_to
);

DELETE FROM helloworldjunktest.user_customization uc
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = uc.singles_id
);

-- Idempotent: ensure the four existing links stay ON DELETE CASCADE.
ALTER TABLE helloworldjunktest.postings
  DROP CONSTRAINT IF EXISTS postings_singles_id_fkey;
ALTER TABLE helloworldjunktest.postings
  ADD CONSTRAINT postings_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.user_activity_sessions
  DROP CONSTRAINT IF EXISTS user_activity_sessions_singles_id_fkey1;
ALTER TABLE helloworldjunktest.user_activity_sessions
  ADD CONSTRAINT user_activity_sessions_singles_id_fkey1
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.misc_bio
  DROP CONSTRAINT IF EXISTS misc_bio_singles_id_fkey;
ALTER TABLE helloworldjunktest.misc_bio
  ADD CONSTRAINT misc_bio_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.vet_bio
  DROP CONSTRAINT IF EXISTS vet_bio_singles_id_fkey;
ALTER TABLE helloworldjunktest.vet_bio
  ADD CONSTRAINT vet_bio_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

-- New FK links (were missing in beforeCascadeDelete9TableFix06182026.sql).
ALTER TABLE helloworldjunktest.audit_registrations
  DROP CONSTRAINT IF EXISTS audit_registrations_singles_id_fkey;
ALTER TABLE helloworldjunktest.audit_registrations
  ADD CONSTRAINT audit_registrations_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
  DROP CONSTRAINT IF EXISTS mobile_photo_upload_sessions_singles_id_fkey;
ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
  ADD CONSTRAINT mobile_photo_upload_sessions_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.photos
  DROP CONSTRAINT IF EXISTS photos_singles_id_fkey;
ALTER TABLE helloworldjunktest.photos
  ADD CONSTRAINT photos_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.requests
  DROP CONSTRAINT IF EXISTS requests_singles_id_from_fkey;
ALTER TABLE helloworldjunktest.requests
  ADD CONSTRAINT requests_singles_id_from_fkey
  FOREIGN KEY (singles_id_from) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.requests
  DROP CONSTRAINT IF EXISTS requests_singles_id_to_fkey;
ALTER TABLE helloworldjunktest.requests
  ADD CONSTRAINT requests_singles_id_to_fkey
  FOREIGN KEY (singles_id_to) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_singles_id_fkey;
ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

COMMIT;
