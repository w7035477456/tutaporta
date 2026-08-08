-- Hard-delete ALL rows still using type = deleted (member album + system/verification).
-- Prefer: node be/scripts/purgeSoftDeletedAlbumMedia.mjs (also removes on-disk files).

BEGIN;

UPDATE helloworldjunktest.consent_record
SET consent_signature_image_fk = NULL
WHERE consent_signature_image_fk IN (
  SELECT photos_id FROM helloworldjunktest.photos WHERE LOWER(COALESCE(type::text, 'uploaded')) = 'deleted'
);

UPDATE helloworldjunktest.consent_record
SET consent_signature_video_fk = NULL
WHERE consent_signature_video_fk IN (
  SELECT video_id FROM helloworldjunktest.videos WHERE LOWER(type::text) = 'deleted'
);

UPDATE helloworldjunktest.singles s
SET profile_image_fk = NULL
FROM helloworldjunktest.photos p
WHERE s.profile_image_fk = p.photos_id
  AND LOWER(COALESCE(p.type::text, 'uploaded')) = 'deleted';

DELETE FROM helloworldjunktest.photos
WHERE LOWER(COALESCE(type::text, 'uploaded')) = 'deleted';

DELETE FROM helloworldjunktest.videos
WHERE LOWER(type::text) = 'deleted';

COMMIT;
