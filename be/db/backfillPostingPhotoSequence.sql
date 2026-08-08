-- Backfill posting_photos.posting_photo_sequence (1..N per singles_id by post time)
-- and sync helloworldjunktest.singles.current_posting_photo_sequence to MAX(sequence).
-- Run on Primary only.

BEGIN;

WITH ordered AS (
  SELECT
    pp.photo_id,
    p.singles_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.singles_id
      ORDER BY p.created_at ASC, pp.photo_id ASC
    ) AS seq
  FROM helloworldjunktest.posting_photos pp
  INNER JOIN helloworldjunktest.postings p ON p.post_id = pp.post_id
)
UPDATE helloworldjunktest.posting_photos pp
SET posting_photo_sequence = ordered.seq
FROM ordered
WHERE pp.photo_id = ordered.photo_id;

UPDATE helloworldjunktest.singles s
SET current_posting_photo_sequence = COALESCE(stats.max_seq, 0)
FROM (
  SELECT
    p.singles_id,
    MAX(pp.posting_photo_sequence) AS max_seq
  FROM helloworldjunktest.postings p
  INNER JOIN helloworldjunktest.posting_photos pp ON pp.post_id = p.post_id
  GROUP BY p.singles_id
) stats
WHERE s.singles_id = stats.singles_id;

UPDATE helloworldjunktest.singles s
SET current_posting_photo_sequence = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM helloworldjunktest.postings p
  INNER JOIN helloworldjunktest.posting_photos pp ON pp.post_id = p.post_id
  WHERE p.singles_id = s.singles_id
);

COMMIT;
