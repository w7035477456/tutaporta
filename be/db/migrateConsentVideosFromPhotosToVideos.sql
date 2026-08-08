-- Move consent / live-scan videos from helloworldjunktest.photos → helloworldjunktest.videos.
-- Updates consent_record.consent_signature_video_fk; clears consent_signature_image_fk for those rows.
-- On-disk filenames are preserved (video_file_name = photos.photo_file_name base).
--
-- Prereq: be/db/addVideosTable.sql
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/migrateConsentVideosFromPhotosToVideos.sql

BEGIN;

CREATE TEMP TABLE _photo_video_migrate (
  photos_id bigint PRIMARY KEY,
  video_id bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  r RECORD;
  new_video_id bigint;
  ext_normalized text;
  file_base text;
BEGIN
  FOR r IN
    SELECT
      p.photos_id,
      p.singles_id,
      p.created_at,
      p.file_path,
      p.file_extension,
      p.type,
      p.photo_file_name,
      p.checksum
    FROM helloworldjunktest.photos p
    WHERE lower(regexp_replace(coalesce(p.file_extension, ''), '^\.', '')) IN ('webm', 'mp4', 'mp3')
       OR lower(coalesce(p.photo_file_name, '')) LIKE 'consent_live_scan_video_%'
       OR (
         lower(coalesce(p.photo_file_name, '')) LIKE 'consent_media_%'
         AND lower(regexp_replace(coalesce(p.file_extension, ''), '^\.', '')) IN ('webm', 'mp4', 'mp3')
       )
    ORDER BY p.photos_id
  LOOP
    ext_normalized := lower(regexp_replace(coalesce(r.file_extension, 'webm'), '^\.', ''));
    IF ext_normalized NOT IN ('webm', 'mp4', 'mp3') THEN
      ext_normalized := 'webm';
    END IF;

    file_base := regexp_replace(trim(coalesce(r.photo_file_name, '')), '\.(webm|mp4|mp3)$', '', 'i');
    IF file_base = '' THEN
      file_base := format('video_%s_%s', r.singles_id, (extract(epoch FROM coalesce(r.created_at, now())) * 1000)::bigint);
    END IF;

    INSERT INTO helloworldjunktest.videos (
      singles_id,
      created_at,
      file_path,
      file_extension,
      type,
      video_file_name,
      checksum
    )
    VALUES (
      r.singles_id,
      coalesce(r.created_at, CURRENT_TIMESTAMP),
      r.file_path,
      ext_normalized,
      coalesce(r.type, 'deleted'::helloworldjunktest.photo_type_enum),
      file_base,
      coalesce(r.checksum, '')
    )
    RETURNING video_id INTO new_video_id;

    INSERT INTO _photo_video_migrate (photos_id, video_id) VALUES (r.photos_id, new_video_id);
  END LOOP;
END $$;

UPDATE helloworldjunktest.consent_record cr
SET
  consent_signature_video_fk = m.video_id,
  consent_signature_image_fk = NULL
FROM _photo_video_migrate m
WHERE cr.consent_signature_image_fk = m.photos_id;

UPDATE helloworldjunktest.singles s
SET profile_image_fk = NULL
FROM _photo_video_migrate m
WHERE s.profile_image_fk = m.photos_id;

DELETE FROM helloworldjunktest.photos p
USING _photo_video_migrate m
WHERE p.photos_id = m.photos_id;

COMMIT;
