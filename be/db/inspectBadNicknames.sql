-- Inspect nicknames that likely break Adj + real first name + same-first-letter rules.
-- (Authoritative repair is: node be/scripts/fixBadNicknames.js --apply)
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/inspectBadNicknames.sql

-- 1) List current aliases (quick review)
SELECT singles_id, member_id, alias,
       COALESCE(NULLIF(BTRIM(gender_self_report::text), ''), NULLIF(BTRIM(dl_sex::text), '')) AS sex,
       mailing_firstname, email
FROM helloworldjunktest.singles
WHERE alias IS NOT NULL AND BTRIM(alias) <> ''
ORDER BY singles_id;

-- 2) Protect / leave alone the seeded demo-friend packs
-- Female pack: JazzyJeff, BrainyBobby, LuckyLuke
-- Male pack:   RapidRuth, GiddyGail, SillySue
SELECT singles_id, alias, email
FROM helloworldjunktest.singles
WHERE LOWER(TRIM(alias)) IN (
  'jazzyjeff', 'brainybobby', 'luckyluke',
  'rapidruth', 'giddygail', 'sillysue'
)
ORDER BY alias;
