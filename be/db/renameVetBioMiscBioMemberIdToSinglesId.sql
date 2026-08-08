-- Rename vet_bio.member_id and misc_bio.member_id → singles_id; FK to singles.singles_id.
-- Run on Primary only:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/renameVetBioMiscBioMemberIdToSinglesId.sql

BEGIN;

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

ALTER TABLE helloworldjunktest.vet_bio
  DROP CONSTRAINT IF EXISTS vet_bio_member_id_uniq;

ALTER TABLE helloworldjunktest.misc_bio
  DROP CONSTRAINT IF EXISTS misc_bio_member_id_uniq;

ALTER TABLE helloworldjunktest.vet_bio
  RENAME COLUMN member_id TO singles_id;

ALTER TABLE helloworldjunktest.misc_bio
  RENAME COLUMN member_id TO singles_id;

ALTER TABLE ONLY helloworldjunktest.vet_bio
  ADD CONSTRAINT vet_bio_singles_id_uniq UNIQUE (singles_id);

ALTER TABLE ONLY helloworldjunktest.misc_bio
  ADD CONSTRAINT misc_bio_singles_id_uniq UNIQUE (singles_id);

DROP INDEX IF EXISTS helloworldjunktest.idx_misc_bio_member_id;
CREATE INDEX IF NOT EXISTS idx_misc_bio_singles_id ON helloworldjunktest.misc_bio USING btree (singles_id);
CREATE INDEX IF NOT EXISTS idx_vet_bio_singles_id ON helloworldjunktest.vet_bio USING btree (singles_id);

-- Remove rows that no longer reference a singles row (dev/stale data) before enforcing FK.
DELETE FROM helloworldjunktest.vet_bio vb
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = vb.singles_id
);

DELETE FROM helloworldjunktest.misc_bio mb
WHERE NOT EXISTS (
  SELECT 1 FROM helloworldjunktest.singles s WHERE s.singles_id = mb.singles_id
);

ALTER TABLE helloworldjunktest.vet_bio
  DROP CONSTRAINT IF EXISTS vet_bio_singles_id_fkey;

ALTER TABLE helloworldjunktest.misc_bio
  DROP CONSTRAINT IF EXISTS misc_bio_singles_id_fkey;

ALTER TABLE helloworldjunktest.vet_bio
  ADD CONSTRAINT vet_bio_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

ALTER TABLE helloworldjunktest.misc_bio
  ADD CONSTRAINT misc_bio_singles_id_fkey
  FOREIGN KEY (singles_id) REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE;

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

COMMIT;
