-- Slot 10 (Slide Show Music) in global.default_music_url — Load Default + new users.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/updateSlideShowMusicDefault.sql

BEGIN;

UPDATE helloworldjunktest.global
SET default_music_url = ARRAY[
  'https://www.youtube.com/watch?v=Hj2AxxazIsg&list=PLID3CMyI1sebj_OxyInLVVagh378EtxcG',
  'https://www.youtube.com/watch?v=qikm4sGMXWI&list=RDqikm4sGMXWI&start_radio=1&t=3253s',
  'https://www.youtube.com/watch?v=k3et9dvV5H8&list=RDk3et9dvV5H8&start_radio=1',
  'https://www.youtube.com/watch?v=PJyJWGWY8Aw&list=RDPJyJWGWY8Aw&start_radio=1',
  'https://www.youtube.com/watch?v=OgnLLdO8VD0&list=RDOgnLLdO8VD0&start_radio=1',
  'https://www.youtube.com/watch?v=UbopvNE2SF4&list=RDUbopvNE2SF4&start_radio=1&t=1528s',
  'https://www.youtube.com/watch?v=fOCdw6MwpZs&list=RDfOCdw6MwpZs&start_radio=1',
  'https://www.youtube.com/watch?v=ZuqrjTwRK7U&list=RDZuqrjTwRK7U&start_radio=1',
  'https://www.youtube.com/watch?v=bMuMWHoUtVU&list=RDbMuMWHoUtVU&start_radio=1',
  'https://www.youtube.com/watch?v=yNXkRYhcH3c&list=PLLELmi94d_VkjbSetAGttNvdMoti18mxa&index=2'
]::text[]
WHERE id = 1;

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

COMMIT;

-- Verify: SELECT cardinality(default_music_url), default_music_url[10] FROM helloworldjunktest.global WHERE id = 1;
