-- REGULARMEMBER accounts never respond to bio requests: their incoming request
-- rows must stay `noresponse`. App code already blocks this in
-- toggleRequestApprovalAboutMe.js / toggleInterestedRequestInfo.js; this adds a
-- database backstop so seeds, backfill SQL, and manual psql edits cannot leak an
-- approval that would grant a requester access to a RegularMember's bio, private
-- photos, videos, or friends-only postings.
--
-- brief_approval_date / full_approval_date are optional (see addRequestsApprovalDate.sql
-- and addRequestsFullApprovalDate.sql), so both statements are built from
-- information_schema the same way the Node routes do.
--
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/enforceRegularMemberBioApprovalNoResponse.sql

-- Dropped up front so the cleanup below is not filtered by an older version of
-- this trigger (which may reference columns this database does not have).
DROP TRIGGER IF EXISTS trg_force_regular_member_bio_approval_noresponse
  ON helloworldjunktest.requests;

DO $migration$
DECLARE
  has_brief_date boolean;
  has_full_date boolean;
  date_set_sql text := '';
  date_where_sql text := '';
  date_assign_sql text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'requests'
       AND column_name = 'brief_approval_date'
  ) INTO has_brief_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'requests'
       AND column_name = 'full_approval_date'
  ) INTO has_full_date;

  IF has_brief_date THEN
    date_set_sql := date_set_sql || ', brief_approval_date = NULL';
    date_where_sql := date_where_sql || ' OR r.brief_approval_date IS NOT NULL';
    date_assign_sql := date_assign_sql || '    NEW.brief_approval_date := NULL;' || E'\n';
  END IF;

  IF has_full_date THEN
    date_set_sql := date_set_sql || ', full_approval_date = NULL';
    date_where_sql := date_where_sql || ' OR r.full_approval_date IS NOT NULL';
    date_assign_sql := date_assign_sql || '    NEW.full_approval_date := NULL;' || E'\n';
  END IF;

  -- 1. One-time cleanup of rows that already hold an approval for a RegularMember.
  EXECUTE format($sql$
    UPDATE helloworldjunktest.requests r
    SET brief_bio_request_approval = 'noresponse'::helloworldjunktest.approval_status_enum,
        full_bio_request_approval = 'noresponse'::helloworldjunktest.approval_status_enum%s,
        updated_at = CURRENT_TIMESTAMP
    FROM helloworldjunktest.singles s
    WHERE s.singles_id = r.singles_id_to
      AND UPPER(BTRIM(COALESCE(s.member_category::text, ''))) = 'REGULARMEMBER'
      AND (
        LOWER(BTRIM(COALESCE(r.brief_bio_request_approval::text, 'noresponse'))) NOT IN ('noresponse', 'na', '')
        OR LOWER(BTRIM(COALESCE(r.full_bio_request_approval::text, 'noresponse'))) NOT IN ('noresponse', 'na', '')%s
      )
  $sql$, date_set_sql, date_where_sql);

  -- 2. Trigger: coerce rather than reject, so bulk seeds and backfills keep working.
  EXECUTE format($sql$
    CREATE OR REPLACE FUNCTION helloworldjunktest.force_regular_member_bio_approval_noresponse()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      recipient_category text;
    BEGIN
      SELECT UPPER(BTRIM(COALESCE(member_category::text, '')))
        INTO recipient_category
        FROM helloworldjunktest.singles
       WHERE singles_id = NEW.singles_id_to;

      IF recipient_category = 'REGULARMEMBER' THEN
        NEW.brief_bio_request_approval := 'noresponse'::helloworldjunktest.approval_status_enum;
        NEW.full_bio_request_approval := 'noresponse'::helloworldjunktest.approval_status_enum;
    %s  END IF;

      RETURN NEW;
    END;
    $fn$;
  $sql$, date_assign_sql);
END
$migration$;

CREATE TRIGGER trg_force_regular_member_bio_approval_noresponse
BEFORE INSERT OR UPDATE ON helloworldjunktest.requests
FOR EACH ROW
EXECUTE FUNCTION helloworldjunktest.force_regular_member_bio_approval_noresponse();
