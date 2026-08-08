-- Repost credit: who originally authored a shared/reposted posting (cluster-wide on Primary).
-- Run on Primary only. Mac dev:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addPostingsRepostedFromSinglesId.sql

DO $$
DECLARE
  sch text := 'helloworldjunktest';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
    RAISE NOTICE 'Schema % not found — skipped', sch;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = sch
      AND table_name = 'postings'
  ) THEN
    RAISE NOTICE 'Table %.postings not found — skipped', sch;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = sch
      AND table_name = 'postings'
      AND column_name = 'reposted_from_singles_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.postings ADD COLUMN reposted_from_singles_id bigint NULL',
      sch
    );
    RAISE NOTICE 'Added %.postings.reposted_from_singles_id', sch;
  ELSE
    RAISE NOTICE 'Column %.postings.reposted_from_singles_id already exists', sch;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = sch
      AND table_name = 'postings'
      AND column_name = 'reposted_from_post_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I.postings ADD COLUMN reposted_from_post_id bigint NULL',
      sch
    );
    RAISE NOTICE 'Added %.postings.reposted_from_post_id', sch;
  ELSE
    RAISE NOTICE 'Column %.postings.reposted_from_post_id already exists', sch;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_postings_reposted_from_singles_id
  ON helloworldjunktest.postings (reposted_from_singles_id)
  WHERE reposted_from_singles_id IS NOT NULL;
