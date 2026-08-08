-- Truncate photos + social/chat partition data, drop monthly (and default) children,
-- recreate quarterly RANGE partitions for current UTC quarter + next quarter only.
--
-- Run on Postgres **Primary** only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/migrateToQuarterlyPartitions.sql
--
-- Naming: {table}_{year}_quarter{1-4}  (UTC calendar quarters)
--   chat_log, postings, posting_comments  → RANGE (created_at)
--   posting_photos                        → RANGE (post_created_at)
-- Further quarters are created on demand by be/utils/ensureQuarterlyPartitions.js.

BEGIN;

TRUNCATE TABLE helloworldjunktest.photos;

TRUNCATE TABLE helloworldjunktest.chat_log;
TRUNCATE TABLE helloworldjunktest.postings;
TRUNCATE TABLE helloworldjunktest.posting_photos;
TRUNCATE TABLE helloworldjunktest.posting_comments;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS part_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class parent ON parent.oid = i.inhparent
    WHERE n.nspname = 'helloworldjunktest'
      AND parent.relname IN ('chat_log', 'postings', 'posting_photos', 'posting_comments')
      AND c.relispartition
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS helloworldjunktest.%I', r.part_name);
  END LOOP;
END $$;

DO $$
DECLARE
  parent_table text;
  cur_start timestamptz;
  next_start timestamptz;
  next_end timestamptz;
  y int;
  q int;
  ny int;
  nq int;
BEGIN
  cur_start := (date_trunc('quarter', (NOW() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC');
  next_start := cur_start + INTERVAL '3 months';
  next_end := next_start + INTERVAL '3 months';

  y := extract(year FROM cur_start AT TIME ZONE 'UTC')::int;
  q := ((extract(month FROM cur_start AT TIME ZONE 'UTC')::int - 1) / 3) + 1;
  ny := extract(year FROM next_start AT TIME ZONE 'UTC')::int;
  nq := ((extract(month FROM next_start AT TIME ZONE 'UTC')::int - 1) / 3) + 1;

  FOREACH parent_table IN ARRAY ARRAY['chat_log', 'postings', 'posting_photos', 'posting_comments']
  LOOP
    EXECUTE format(
      'CREATE TABLE helloworldjunktest.%I_%s_quarter%s PARTITION OF helloworldjunktest.%I FOR VALUES FROM (%L) TO (%L)',
      parent_table, y, q, parent_table, cur_start, next_start
    );
    EXECUTE format(
      'CREATE TABLE helloworldjunktest.%I_%s_quarter%s PARTITION OF helloworldjunktest.%I FOR VALUES FROM (%L) TO (%L)',
      parent_table, ny, nq, parent_table, next_start, next_end
    );
  END LOOP;
END $$;

COMMIT;
