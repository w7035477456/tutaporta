-- Defense in depth: block TRUNCATE on singles; block DELETE of reserved member_id 999999.
-- TRUNCATE bypasses row-level DELETE triggers — photos TRUNCATE + CASCADE previously wiped singles.
--
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/protectSystemToolsAdminSinglesTruncate.sql

CREATE OR REPLACE FUNCTION helloworldjunktest.prevent_system_tools_admin_singles_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(COALESCE(OLD.email::text, '')) = lower('tools-admin@vsingles.internal')
     OR OLD.member_id = 999999 THEN
    RAISE EXCEPTION 'System tools admin account cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION helloworldjunktest.prevent_singles_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'helloworldjunktest.singles cannot be truncated';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_singles_truncate ON helloworldjunktest.singles;

CREATE TRIGGER trg_prevent_singles_truncate
BEFORE TRUNCATE ON helloworldjunktest.singles
FOR EACH STATEMENT
EXECUTE FUNCTION helloworldjunktest.prevent_singles_truncate();
