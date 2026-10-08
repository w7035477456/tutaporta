-- Postings / posting_photos / posting_comments performance indexes (outdateddbsnapshotoct2024).
-- Run on Postgres **Primary** only. Replicas pick up via replication.
--
-- Verified missing from be/db/dbBackup06012026.sql (Jun 2026 dump has partitioned tables but no posting* indexes).
-- Supports My Picks feed, chat posts, profile posts (nested COUNT + json_agg on photos/comments).
--
-- Check after apply:
--   SELECT indexname, tablename
--   FROM pg_indexes
--   WHERE schemaname = 'outdateddbsnapshotoct2024'
--     AND tablename IN ('postings', 'posting_photos', 'posting_comments')
--   ORDER BY tablename, indexname;

-- Feed: WHERE p.singles_id = $1 ORDER BY created_at DESC, post_id DESC
CREATE INDEX IF NOT EXISTS idx_postings_singles_created_post
  ON outdateddbsnapshotoct2024.postings (singles_id, created_at DESC, post_id DESC);

-- Photos per post: WHERE pp.post_id = p.post_id ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_posting_photos_post_sort
  ON outdateddbsnapshotoct2024.posting_photos (post_id, sort_order, photo_id);

-- Comment counts / likes per photo
CREATE INDEX IF NOT EXISTS posting_comments_photo_id_idx
  ON outdateddbsnapshotoct2024.posting_comments (photo_id);

CREATE INDEX IF NOT EXISTS posting_comments_author_id_idx
  ON outdateddbsnapshotoct2024.posting_comments (author_id);

CREATE INDEX IF NOT EXISTS idx_posting_comments_author_photo_empty
  ON outdateddbsnapshotoct2024.posting_comments (author_id, photo_id)
  WHERE btrim(COALESCE(posting_text, ''::character varying)::text) = ''::text;

CREATE INDEX IF NOT EXISTS idx_posting_comments_photo_author_liked
  ON outdateddbsnapshotoct2024.posting_comments (photo_id, author_id, is_liked);

CREATE INDEX IF NOT EXISTS idx_posting_comments_photo_liked_created
  ON outdateddbsnapshotoct2024.posting_comments (photo_id, is_liked, created_at, comment_id);
