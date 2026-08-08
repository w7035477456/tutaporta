-- FK + UNIQUE on helloworldjunktest.singles.profile_image_fk → photos.photos_id.
-- Orphan cleanup: NULL profile_image_fk when photos row missing.
-- Duplicate cleanup: one photos_id may be profile for at most one singles row.
--
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesProfileImageFk.sql

BEGIN;

-- Orphans: profile_image_fk with no matching photos row → NULL
UPDATE helloworldjunktest.singles s
SET profile_image_fk = NULL
WHERE s.profile_image_fk IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM helloworldjunktest.photos p
    WHERE p.photos_id = s.profile_image_fk
  );

-- Duplicates: same photos_id used as profile by multiple singles → keep lowest singles_id
WITH dup_keep AS (
  SELECT profile_image_fk, MIN(singles_id) AS keep_singles_id
  FROM helloworldjunktest.singles
  WHERE profile_image_fk IS NOT NULL
  GROUP BY profile_image_fk
  HAVING COUNT(*) > 1
)
UPDATE helloworldjunktest.singles s
SET profile_image_fk = NULL
FROM dup_keep d
WHERE s.profile_image_fk = d.profile_image_fk
  AND s.singles_id <> d.keep_singles_id;

ALTER TABLE helloworldjunktest.singles
  DROP CONSTRAINT IF EXISTS singles_profile_image_fk_fkey;

ALTER TABLE helloworldjunktest.singles
  ADD CONSTRAINT singles_profile_image_fk_fkey
  FOREIGN KEY (profile_image_fk)
  REFERENCES helloworldjunktest.photos (photos_id)
  ON DELETE SET NULL;

ALTER TABLE helloworldjunktest.singles
  DROP CONSTRAINT IF EXISTS singles_profile_image_fk_key;

ALTER TABLE helloworldjunktest.singles
  ADD CONSTRAINT singles_profile_image_fk_key
  UNIQUE (profile_image_fk);

COMMIT;
