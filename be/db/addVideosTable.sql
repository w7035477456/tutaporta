-- outdateddbsnapshotoct2024.videos — consent / live-scan video storage (separate from photos).
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addVideosTable.sql

BEGIN;

CREATE SEQUENCE IF NOT EXISTS outdateddbsnapshotoct2024.video_id_seq;
CREATE SEQUENCE IF NOT EXISTS outdateddbsnapshotoct2024.videos_video_id_index_seq;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.videos (
  video_id bigint NOT NULL DEFAULT nextval('outdateddbsnapshotoct2024.video_id_seq'::regclass),
  singles_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  file_path character varying(255),
  file_extension character varying(10) NOT NULL DEFAULT 'webm'::character varying,
  video_id_index bigint NOT NULL DEFAULT nextval('outdateddbsnapshotoct2024.videos_video_id_index_seq'::regclass),
  type outdateddbsnapshotoct2024.photo_type_enum NOT NULL DEFAULT 'deleted'::outdateddbsnapshotoct2024.photo_type_enum,
  video_file_name character varying(100) NOT NULL,
  checksum text NOT NULL,
  video_thumbnail character varying(120),
  CONSTRAINT videos_pkey PRIMARY KEY (video_id),
  CONSTRAINT videos_file_extension_check CHECK (
    lower(file_extension::text) = ANY (ARRAY['webm'::text, 'mp4'::text, 'mp3'::text])
  ),
  CONSTRAINT videos_singles_id_fkey FOREIGN KEY (singles_id)
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_singles_id ON outdateddbsnapshotoct2024.videos (singles_id);

ALTER TABLE outdateddbsnapshotoct2024.consent_record
  ADD COLUMN IF NOT EXISTS consent_signature_video_fk bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consent_record_consent_signature_video_fk_fkey'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.consent_record
      ADD CONSTRAINT consent_record_consent_signature_video_fk_fkey
      FOREIGN KEY (consent_signature_video_fk)
      REFERENCES outdateddbsnapshotoct2024.videos (video_id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
