-- Find / manually fix nicknames that share the same adjective (e.g. WackyWillie + WackyWanda).
-- Preferred repair (auto, prefers unused adjectives):
--   node be/scripts/fixDuplicateAdjectives.js
--   node be/scripts/fixDuplicateAdjectives.js --apply
--
-- Mac inspect:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/fixDuplicateAdjectiveWacky.sql

-- 1) List current Wacky* (example collision from UI)
SELECT singles_id, member_id, alias
FROM helloworldjunktest.singles
WHERE alias IS NOT NULL
  AND BTRIM(alias) <> ''
  AND LOWER(alias) LIKE 'wacky%'
ORDER BY singles_id;

-- 2) Manual one-off: keep the earliest Wacky*, rename a later duplicate to another W-adjective + name.
--    (Only needed if you are not using the node script.)
-- Example was: singles_id 39 WackyWanda kept, singles_id 42 WackyWillie -> DashDanny via script.
-- Alternate manual example:
-- UPDATE helloworldjunktest.singles
-- SET alias = 'WittyWillie', updated_at = CURRENT_TIMESTAMP
-- WHERE singles_id = 42
--   AND LOWER(TRIM(alias)) = 'wackywillie';
