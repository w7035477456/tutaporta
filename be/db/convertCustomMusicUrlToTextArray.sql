-- Convert user_customization.custom_music_url from single text to text[] (legacy; see expandCustomMusicUrlTo10Slots.sql for 10 slots).
-- Existing single URL moves into slot 1 (array index 1 in PostgreSQL = first element).
-- Run against Primary. Adjust schema name if not helloworldjunktest.

ALTER TABLE helloworldjunktest.user_customization
  ALTER COLUMN custom_music_url DROP DEFAULT;

ALTER TABLE helloworldjunktest.user_customization
  ALTER COLUMN custom_music_url TYPE text[]
  USING CASE
    WHEN custom_music_url IS NULL OR btrim(custom_music_url) = '' THEN ARRAY[]::text[]
    ELSE ARRAY[custom_music_url]::text[]
  END;

ALTER TABLE helloworldjunktest.user_customization
  ALTER COLUMN custom_music_url SET DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_customization_custom_music_url_limit_chk'
  ) THEN
    ALTER TABLE helloworldjunktest.user_customization
      ADD CONSTRAINT user_customization_custom_music_url_limit_chk
      CHECK (
        custom_music_url IS NULL
        OR (
          cardinality(custom_music_url) <= 10
          AND (array_ndims(custom_music_url) IS NULL OR array_ndims(custom_music_url) = 1)
        )
      );
  END IF;
END
$$;
