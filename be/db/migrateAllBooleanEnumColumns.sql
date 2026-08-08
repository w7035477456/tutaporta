-- Run on Primary only.
-- Converts PostgreSQL boolean columns to boolean_enum ('true' | 'false').
-- Matches booleanEnum06092026.sql / live schema in helloworldjunktest.
--
-- Tables / columns:
--   posting_comments.is_liked, is_shared (parent + partitions)
--   requests.interested, brief_paid, full_paid, block_user
--   singles.optoutadvertise, initial_setup_done
--   singles_checkr.*_verified (5 columns)
--   user_customization.lyric_mute
--   user_education_verifications.is_verified

DO $$
DECLARE
  sch text;
  schemas text[] := ARRAY['helloworldjunktest', 'public'];
  tbl text;
  col text;
  nullable text;
  req_cols text[] := ARRAY['interested', 'brief_paid', 'full_paid', 'block_user'];
  static_targets constant jsonb := '[
    {"table":"posting_comments","columns":["is_liked","is_shared"]},
    {"table":"singles","columns":["optoutadvertise","initial_setup_done"]},
    {"table":"singles_checkr","columns":["education_verified","employment_verified","identity_verified","credit_verified","license_verified"]},
    {"table":"user_customization","columns":["lyric_mute"]},
    {"table":"user_education_verifications","columns":["is_verified"]}
  ]'::jsonb;
  target jsonb;
  target_cols jsonb;
BEGIN
  FOREACH sch IN ARRAY schemas LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = sch) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = sch
        AND t.typname = 'boolean_enum'
    ) THEN
      EXECUTE format('CREATE TYPE %I.boolean_enum AS ENUM (''true'', ''false'')', sch);
      RAISE NOTICE 'Created %.boolean_enum', sch;
    END IF;

    -- Static table/column targets
    FOR target IN SELECT value FROM jsonb_array_elements(static_targets) LOOP
      tbl := target->>'table';
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = sch
          AND table_name = tbl
      ) THEN
        CONTINUE;
      END IF;

      FOR col IN
        SELECT jsonb_array_elements_text(target->'columns')
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = sch
            AND table_name = tbl
            AND column_name = col
            AND udt_name = 'bool'
        ) THEN
          CONTINUE;
        END IF;

        SELECT is_nullable
        INTO nullable
        FROM information_schema.columns
        WHERE table_schema = sch
          AND table_name = tbl
          AND column_name = col;

        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', sch, tbl, col);
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE %I.boolean_enum
           USING (
             CASE
               WHEN %I IS TRUE THEN ''true''::%I.boolean_enum
               ELSE ''false''::%I.boolean_enum
             END
           )',
          sch,
          tbl,
          col,
          sch,
          col,
          sch,
          sch
        );
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT ''false''::%I.boolean_enum',
          sch,
          tbl,
          col,
          sch
        );
        IF nullable = 'NO' THEN
          EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET NOT NULL', sch, tbl, col);
        END IF;
        RAISE NOTICE 'Converted %.%.% -> boolean_enum', sch, tbl, col;
      END LOOP;
    END LOOP;

    -- requests.* (column names vary by migration history)
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = sch
        AND table_name = 'requests'
    ) THEN
      FOREACH col IN ARRAY req_cols LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = sch
            AND table_name = 'requests'
            AND column_name = col
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I.requests
               ADD COLUMN %I %I.boolean_enum NOT NULL
               DEFAULT ''false''::%I.boolean_enum',
            sch,
            col,
            sch,
            sch
          );
          RAISE NOTICE 'Added %.requests.% boolean_enum', sch, col;
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = sch
            AND table_name = 'requests'
            AND column_name = col
            AND udt_name = 'bool'
        ) THEN
          EXECUTE format('ALTER TABLE %I.requests ALTER COLUMN %I DROP DEFAULT', sch, col);
          EXECUTE format(
            'ALTER TABLE %I.requests ALTER COLUMN %I TYPE %I.boolean_enum
             USING (
               CASE
                 WHEN %I IS TRUE THEN ''true''::%I.boolean_enum
                 ELSE ''false''::%I.boolean_enum
               END
             )',
            sch,
            col,
            sch,
            col,
            sch,
            sch
          );
          EXECUTE format(
            'ALTER TABLE %I.requests ALTER COLUMN %I SET DEFAULT ''false''::%I.boolean_enum',
            sch,
            col,
            sch
          );
          EXECUTE format('ALTER TABLE %I.requests ALTER COLUMN %I SET NOT NULL', sch, col);
          RAISE NOTICE 'Converted %.requests.% -> boolean_enum', sch, col;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Verify: converted columns should show udt_name = boolean_enum
SELECT table_schema,
       table_name,
       column_name,
       udt_name,
       column_default,
       is_nullable
FROM information_schema.columns
WHERE udt_name = 'boolean_enum'
  AND table_schema IN ('helloworldjunktest', 'public')
ORDER BY table_schema, table_name, column_name;
