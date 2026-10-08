-- Read-only: list posting-related indexes on outdateddbsnapshotoct2024 (run on replica or primary).
-- Expect at least the names returned by addPostingsPerformanceIndexes.sql.

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'outdateddbsnapshotoct2024'
  AND tablename IN ('postings', 'posting_photos', 'posting_comments')
ORDER BY tablename, indexname;
