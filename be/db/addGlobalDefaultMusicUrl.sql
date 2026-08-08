-- global.default_music_url — default Embedded Youtube Player slots (text[], 10 URLs).
-- Slots 1–9 = tracks; slot 10 = Slide Show Music.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addGlobalDefaultMusicUrl.sql

BEGIN;

ALTER TABLE helloworldjunktest.global
  ADD COLUMN IF NOT EXISTS default_music_url text[] NOT NULL DEFAULT ARRAY[]::text[];

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

COMMIT;

-- Verify: SELECT cardinality(default_music_url), default_music_url[1] FROM helloworldjunktest.global WHERE id = 1;
