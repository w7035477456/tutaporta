-- Drop legacy post-level comments table (replaced by posting_comments on posting photos).
-- Run on Postgres **Primary** only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/dropCommentsTable.sql

DROP TABLE IF EXISTS helloworldjunktest.comments;
DROP SEQUENCE IF EXISTS helloworldjunktest.comments_comment_id_seq;
