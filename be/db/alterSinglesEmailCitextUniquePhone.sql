-- helloworldjunktest.singles — email text + UNIQUE email/phone, phone NOT NULL (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/alterSinglesEmailCitextUniquePhone.sql

-- Canonical US phone: +1XXXXXXXXXX
UPDATE helloworldjunktest.singles s
SET phone = CASE
  WHEN digits ~ '^1\d{10}$' THEN '+' || digits
  WHEN length(digits) = 10 THEN '+1' || digits
  ELSE s.phone
END
FROM (
  SELECT singles_id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS digits
  FROM helloworldjunktest.singles
) norm
WHERE s.singles_id = norm.singles_id
  AND norm.digits <> ''
  AND s.phone IS DISTINCT FROM CASE
    WHEN norm.digits ~ '^1\d{10}$' THEN '+' || norm.digits
    WHEN length(norm.digits) = 10 THEN '+1' || norm.digits
    ELSE s.phone
  END;

-- Resolve duplicate phones by keeping the lowest singles_id and bumping others to a nearby unique number.
DO $$
DECLARE
  dup RECORD;
  sid bigint;
  offset_n int;
  base_digits bigint;
  new_digits bigint;
BEGIN
  FOR dup IN
    SELECT phone, array_agg(singles_id ORDER BY singles_id) AS ids
    FROM helloworldjunktest.singles
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    base_digits := regexp_replace(dup.phone, '\D', '', 'g')::bigint;
    offset_n := 0;
    FOREACH sid IN ARRAY dup.ids[2:array_length(dup.ids, 1)]
    LOOP
      offset_n := offset_n + 1;
      new_digits := base_digits + offset_n;
      UPDATE helloworldjunktest.singles
      SET phone = '+' || new_digits::text
      WHERE singles_id = sid;
    END LOOP;
  END LOOP;
END $$;

UPDATE helloworldjunktest.singles
SET email = LOWER(email::text)
WHERE email IS NOT NULL
  AND email::text <> LOWER(email::text);

DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT LOWER(email::text) AS email_key, COUNT(*) AS cnt
    FROM helloworldjunktest.singles
    GROUP BY LOWER(email::text)
    HAVING COUNT(*) > 1
  LOOP
    RAISE EXCEPTION 'Cannot add UNIQUE on singles.email: duplicate email % (% rows)', dup.email_key, dup.cnt;
  END LOOP;

  FOR dup IN
    SELECT phone, COUNT(*) AS cnt
    FROM helloworldjunktest.singles
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    RAISE EXCEPTION 'Cannot add UNIQUE on singles.phone: duplicate phone % (% rows)', dup.phone, dup.cnt;
  END LOOP;
END $$;

-- Views reference singles.email; drop and recreate around the email type change.
DROP VIEW IF EXISTS helloworldjunktest.viewcareer;
DROP VIEW IF EXISTS helloworldjunktest.viewcountryofbirth;
DROP VIEW IF EXISTS helloworldjunktest.viewcurrentcity;
DROP VIEW IF EXISTS helloworldjunktest.vieweducation;
DROP VIEW IF EXISTS helloworldjunktest.viewhobbies;
DROP VIEW IF EXISTS helloworldjunktest.viewjob;
DROP VIEW IF EXISTS helloworldjunktest.viewname;
DROP VIEW IF EXISTS helloworldjunktest.viewphoto;
DROP VIEW IF EXISTS helloworldjunktest.viewreligion;
DROP VIEW IF EXISTS helloworldjunktest.viewvettedstatus;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'email'
      AND udt_name NOT IN ('text', 'citext')
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      ALTER COLUMN email TYPE text USING LOWER(email::text);
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'helloworldjunktest'
      AND table_name = 'singles'
      AND column_name = 'email'
      AND udt_name = 'citext'
  ) THEN
    ALTER TABLE helloworldjunktest.singles
      ALTER COLUMN email TYPE text USING email::text;
  END IF;
END $$;

CREATE VIEW helloworldjunktest.viewcareer AS
 SELECT s.singles_id,
    s.email,
    vb.current_company,
    vb.current_company_vetted,
    vb.current_company_vetted_date,
    vb.current_company_vetted_by_userid,
    vb.current_company_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewcountryofbirth AS
 SELECT s.singles_id,
    s.email,
    vb.countryofcitizenship,
    vb.countryofcitizenship_vetted,
    vb.countryofcitizenship_vetted_date,
    vb.countryofcitizenship_vetted_by_userid,
    vb.countryofcitizenship_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewcurrentcity AS
 SELECT s.singles_id,
    s.email,
    vb.current_city,
    vb.current_city_vetted,
    vb.current_city_vetted_date,
    vb.current_city_vetted_by_userid,
    vb.current_city_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.vieweducation AS
 SELECT s.email,
    vb.college_name,
    vb.college_name_vetted,
    vb.college_name_vetted_date,
    vb.college_name_vetted_by_userid,
    vb.college_name_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewhobbies AS
 SELECT s.singles_id,
    s.email,
    mb.favorite_hobbies AS hobbies,
    NULL::helloworldjunktest.vetting_status AS hobbies_vetted,
    NULL::timestamp without time zone AS hobbies_vetted_date,
    NULL::bigint AS hobbies_vetted_by_userid,
    'n/a'::character varying(255) AS hobbies_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.misc_bio mb ON mb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewjob AS
 SELECT s.singles_id,
    s.email,
    vb.job_title,
    vb.job_title_vetted,
    vb.job_title_vetted_date,
    vb.job_title_vetted_by_userid,
    vb.job_title_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewname AS
 SELECT s.singles_id,
    s.email,
    s.mailing_firstname AS firstname,
    s.mailing_lastname AS lastname,
    s.mailing_middlename AS middlename,
    vb.fullname_vetted,
    vb.fullname_vetted_date,
    vb.fullname_vetted_by_userid,
    vb.fullname_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewphoto AS
 SELECT s.singles_id,
    s.member_id,
    s.email,
    vb.profilephoto_vetted,
    vb.profilephoto_vetted_date,
    vb.profilephoto_vetted_by_userid,
    vb.profilephoto_vetted_note
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW helloworldjunktest.viewreligion AS
 SELECT s.singles_id,
    s.email,
    NULL::character varying(50) AS religion,
    NULL::helloworldjunktest.vetting_status AS religion_vetted,
    NULL::timestamp without time zone AS religion_vetted_date,
    NULL::bigint AS religion_vetted_by_userid,
    'n/a'::character varying(255) AS religion_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM helloworldjunktest.singles s;

CREATE VIEW helloworldjunktest.viewvettedstatus AS
 SELECT s.singles_id,
    s.email,
    s.vetted_basic_status,
    vb.fullname_vetted,
    vb.profilephoto_vetted,
    vb.age_vetted,
    vb.current_city_vetted,
    s.vetted_detail_status,
    vb.college_name_vetted,
    vb.current_company_vetted,
    NULL::helloworldjunktest.vetting_status AS children_info_vetted,
    vb.homecity_vetted,
    NULL::helloworldjunktest.vetting_status AS religion_vetted,
    NULL::helloworldjunktest.vetting_status AS hobbies_vetted
   FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio vb ON vb.singles_id = s.singles_id
     LEFT JOIN helloworldjunktest.misc_bio mb ON mb.singles_id = s.singles_id;

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE helloworldjunktest.singles
  ALTER COLUMN phone SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS singles_email_unique_idx
  ON helloworldjunktest.singles (email);

CREATE UNIQUE INDEX IF NOT EXISTS singles_phone_unique_idx
  ON helloworldjunktest.singles (phone);

COMMENT ON COLUMN helloworldjunktest.singles.email IS
  'Unique login email (lowercase text). Application code uses normalizeEmailForDb().';

COMMENT ON COLUMN helloworldjunktest.singles.phone IS
  'Unique US phone in +1XXXXXXXXXX format. NOT NULL.';
