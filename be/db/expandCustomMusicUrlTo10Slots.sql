-- Expand user_customization.custom_music_url to up to 10 YouTube URL slots (text[]).
-- Safe if column is still text or already text[] (<=5). Run against Primary.
-- Schema: helloworldjunktest (adjust if needed).

-- 1) Single text column → text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'user_customization'
      AND column_name = 'custom_music_url'
      AND udt_name = 'text'
  ) THEN
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
  END IF;
END
$$;

-- 2) Replace slot-count check (5 → 10)
ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_custom_music_url_limit_chk;

ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_custom_music_url_limit_chk
  CHECK (
    custom_music_url IS NULL
    OR (
      cardinality(custom_music_url) <= 10
      AND (array_ndims(custom_music_url) IS NULL OR array_ndims(custom_music_url) = 1)
    )
  );
