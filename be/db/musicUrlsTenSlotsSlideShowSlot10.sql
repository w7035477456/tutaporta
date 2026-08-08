-- 10 music URL slots: 1–9 tracks, slot 10 = Slide Show Music.
-- Migrates 11-slot rows: keeps slots 1–9, moves old slot 11 → slot 10 when present.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/musicUrlsTenSlotsSlideShowSlot10.sql

BEGIN;

ALTER TABLE helloworldjunktest.user_customization
  DROP CONSTRAINT IF EXISTS user_customization_custom_music_url_limit_chk;

UPDATE helloworldjunktest.user_customization
SET custom_music_url = CASE
  WHEN custom_music_url IS NULL THEN NULL
  WHEN cardinality(custom_music_url) >= 11 THEN
    (custom_music_url[1:9] || custom_music_url[11:11])::text[]
  WHEN cardinality(custom_music_url) = 10 THEN custom_music_url[1:10]
  ELSE custom_music_url
END
WHERE custom_music_url IS NOT NULL;

ALTER TABLE helloworldjunktest.user_customization
  ADD CONSTRAINT user_customization_custom_music_url_limit_chk
  CHECK (
    custom_music_url IS NULL
    OR (
      cardinality(custom_music_url) <= 10
      AND (array_ndims(custom_music_url) IS NULL OR array_ndims(custom_music_url) = 1)
    )
  );

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
  'https://www.youtube.com/watch?v=Dvlc8vqxivl&list=PLIILL6veL7802G94eulr2fzj0wz7CwKqh&index=3'
]::text[]
WHERE id = 1;

COMMIT;
