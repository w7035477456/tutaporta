-- Drop pre-created quarters beyond current UTC quarter + next, and convert
-- user_activity_sessions from monthly to quarterly (current + next only).
--
-- Run on Postgres **Primary** only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/trimQuarterlyPartitionsAndMigrateUserActivity.sql

BEGIN;

DO $trim_social$
DECLARE
  r RECORD;
  cur_start timestamptz;
  next_start timestamptz;
  part_from timestamptz;
  bound_expr text;
  from_match text[];
BEGIN
  cur_start := (date_trunc('quarter', (NOW() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC');
  next_start := cur_start + INTERVAL '3 months';

  FOR r IN
    SELECT c.relname AS part_name, parent.relname AS parent_name,
           pg_get_expr(c.relpartbound, c.oid, true) AS bound_expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class parent ON parent.oid = i.inhparent
    WHERE n.nspname = 'helloworldjunktest'
      AND parent.relname IN ('chat_log', 'postings', 'posting_photos', 'posting_comments')
      AND c.relispartition
  LOOP
    bound_expr := r.bound_expr;
    IF bound_expr = 'DEFAULT' THEN
      EXECUTE format('DROP TABLE helloworldjunktest.%I', r.part_name);
      CONTINUE;
    END IF;

    from_match := regexp_match(bound_expr, 'FROM \(''([^'']+)''\)');
    IF from_match IS NULL THEN
      CONTINUE;
    END IF;
    part_from := from_match[1]::timestamptz;

    IF part_from <> cur_start AND part_from <> next_start THEN
      EXECUTE format('DROP TABLE helloworldjunktest.%I', r.part_name);
    END IF;
  END LOOP;
END $trim_social$;

CREATE TEMP TABLE uas_quarterly_backup ON COMMIT DROP AS
  SELECT * FROM helloworldjunktest.user_activity_sessions;

DO $drop_uas_monthly$
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
      AND parent.relname = 'user_activity_sessions'
      AND c.relispartition
  LOOP
    EXECUTE format('DROP TABLE helloworldjunktest.%I', r.part_name);
  END LOOP;
END $drop_uas_monthly$;

DO $create_uas_quarterly$
DECLARE
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

  EXECUTE format(
    'CREATE TABLE helloworldjunktest.user_activity_sessions_%s_quarter%s PARTITION OF helloworldjunktest.user_activity_sessions FOR VALUES FROM (%L) TO (%L)',
    y, q, cur_start, next_start
  );
  EXECUTE format(
    'CREATE TABLE helloworldjunktest.user_activity_sessions_%s_quarter%s PARTITION OF helloworldjunktest.user_activity_sessions FOR VALUES FROM (%L) TO (%L)',
    ny, nq, next_start, next_end
  );
END $create_uas_quarterly$;

INSERT INTO helloworldjunktest.user_activity_sessions (
  session_id, singles_id, login_at, logout_at, logout_reason, created_at
)
SELECT session_id, singles_id, login_at, logout_at, logout_reason, created_at
FROM uas_quarterly_backup;

SELECT setval(
  pg_get_serial_sequence('helloworldjunktest.user_activity_sessions', 'session_id'),
  COALESCE((SELECT MAX(session_id) FROM helloworldjunktest.user_activity_sessions), 1)
);

COMMIT;
