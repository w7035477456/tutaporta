-- Read-only: list posting-related indexes on helloworldjunktest (run on replica or primary).
-- Expect at least the names returned by addPostingsPerformanceIndexes.sql.

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'helloworldjunktest'
  AND tablename IN ('postings', 'posting_photos', 'posting_comments')
ORDER BY tablename, indexname;
