-- Convert email columns from citext to text (Primary only).
-- Application code stores lowercase via normalizeEmailForDb(); text + UNIQUE replaces citext.
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/convertCitextEmailToText.sql

UPDATE outdateddbsnapshotoct2024.singles
SET email = LOWER(email::text)
WHERE email IS NOT NULL
  AND email::text <> LOWER(email::text);

DO $$
BEGIN
  IF to_regclass('outdateddbsnapshotoct2024.audit_registrations') IS NOT NULL THEN
    UPDATE outdateddbsnapshotoct2024.audit_registrations
    SET email = LOWER(email::text)
    WHERE email IS NOT NULL
      AND email::text <> LOWER(email::text);
  END IF;
END $$;

DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT LOWER(email::text) AS email_key, COUNT(*) AS cnt
    FROM outdateddbsnapshotoct2024.singles
    GROUP BY LOWER(email::text)
    HAVING COUNT(*) > 1
  LOOP
    RAISE EXCEPTION 'Cannot keep UNIQUE on singles.email: duplicate email % (% rows)', dup.email_key, dup.cnt;
  END LOOP;
END $$;

DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewcareer;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewcountryofbirth;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewcurrentcity;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.vieweducation;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewhobbies;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewjob;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewname;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewphoto;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewreligion;
DROP VIEW IF EXISTS outdateddbsnapshotoct2024.viewvettedstatus;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'outdateddbsnapshotoct2024'
      AND table_name = 'singles'
      AND column_name = 'email'
      AND udt_name = 'citext'
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ALTER COLUMN email TYPE text USING email::text;
  END IF;

  IF to_regclass('outdateddbsnapshotoct2024.audit_registrations') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'outdateddbsnapshotoct2024'
         AND table_name = 'audit_registrations'
         AND column_name = 'email'
         AND udt_name = 'citext'
     ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.audit_registrations
      ALTER COLUMN email TYPE text USING email::text;
  END IF;
END $$;

CREATE VIEW outdateddbsnapshotoct2024.viewcareer AS
 SELECT s.singles_id,
    s.email,
    vb.current_company,
    vb.current_company_vetted,
    vb.current_company_vetted_date,
    vb.current_company_vetted_by_userid,
    vb.current_company_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewcountryofbirth AS
 SELECT s.singles_id,
    s.email,
    vb.countryofcitizenship,
    vb.countryofcitizenship_vetted,
    vb.countryofcitizenship_vetted_date,
    vb.countryofcitizenship_vetted_by_userid,
    vb.countryofcitizenship_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewcurrentcity AS
 SELECT s.singles_id,
    s.email,
    vb.current_city,
    vb.current_city_vetted,
    vb.current_city_vetted_date,
    vb.current_city_vetted_by_userid,
    vb.current_city_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.vieweducation AS
 SELECT s.email,
    vb.college_name,
    vb.college_name_vetted,
    vb.college_name_vetted_date,
    vb.college_name_vetted_by_userid,
    vb.college_name_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewhobbies AS
 SELECT s.singles_id,
    s.email,
    mb.favorite_hobbies AS hobbies,
    NULL::outdateddbsnapshotoct2024.vetting_status AS hobbies_vetted,
    NULL::timestamp without time zone AS hobbies_vetted_date,
    NULL::bigint AS hobbies_vetted_by_userid,
    'n/a'::character varying(255) AS hobbies_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.misc_bio mb ON mb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewjob AS
 SELECT s.singles_id,
    s.email,
    vb.job_title,
    vb.job_title_vetted,
    vb.job_title_vetted_date,
    vb.job_title_vetted_by_userid,
    vb.job_title_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewname AS
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
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewphoto AS
 SELECT s.singles_id,
    s.member_id,
    s.email,
    vb.profilephoto_vetted,
    vb.profilephoto_vetted_date,
    vb.profilephoto_vetted_by_userid,
    vb.profilephoto_vetted_note
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id;

CREATE VIEW outdateddbsnapshotoct2024.viewreligion AS
 SELECT s.singles_id,
    s.email,
    NULL::character varying(50) AS religion,
    NULL::outdateddbsnapshotoct2024.vetting_status AS religion_vetted,
    NULL::timestamp without time zone AS religion_vetted_date,
    NULL::bigint AS religion_vetted_by_userid,
    'n/a'::character varying(255) AS religion_vetted_note,
    s.vetted_basic_status,
    s.vetted_detail_status
   FROM outdateddbsnapshotoct2024.singles s;

CREATE VIEW outdateddbsnapshotoct2024.viewvettedstatus AS
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
    NULL::outdateddbsnapshotoct2024.vetting_status AS children_info_vetted,
    vb.homecity_vetted,
    NULL::outdateddbsnapshotoct2024.vetting_status AS religion_vetted,
    NULL::outdateddbsnapshotoct2024.vetting_status AS hobbies_vetted
   FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.vet_bio vb ON vb.singles_id = s.singles_id
     LEFT JOIN outdateddbsnapshotoct2024.misc_bio mb ON mb.singles_id = s.singles_id;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.email IS
  'Unique login email (lowercase text). Application code uses normalizeEmailForDb().';

DO $$
BEGIN
  IF to_regclass('outdateddbsnapshotoct2024.audit_registrations') IS NOT NULL THEN
    COMMENT ON COLUMN outdateddbsnapshotoct2024.audit_registrations.email IS
      'Registration audit email (lowercase text). Application code uses normalizeEmailForDb().';
  END IF;
END $$;

DROP EXTENSION IF EXISTS citext;
