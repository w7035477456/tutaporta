-- DemoUser: sync DL names from mailing names; assign distinct mailing_street addresses.
--
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/seedDemoUserMailingDl.sql

BEGIN;

UPDATE helloworldjunktest.singles
SET
  dl_firstname = NULLIF(BTRIM(mailing_firstname), ''),
  dl_middlename = NULLIF(BTRIM(mailing_middlename), ''),
  dl_lastname = NULLIF(BTRIM(mailing_lastname), ''),
  updated_at = CURRENT_TIMESTAMP
WHERE member_category = 'DemoUser';

WITH ranked AS (
  SELECT
    s.singles_id,
    ROW_NUMBER() OVER (ORDER BY s.singles_id)::int AS rn
  FROM helloworldjunktest.singles s
  WHERE s.member_category = 'DemoUser'
),
addrs(rn, mailing_street) AS (
  VALUES
    (1,  '812 Maple Ave, Arlington, VA 22201'),
    (2,  '1450 Cascade Rd, Fairfax, VA 22030'),
    (3,  '2201 Crystal Dr Apt 412, Arlington, VA 22202'),
    (4,  '901 Ballston Blvd, Arlington, VA 22203'),
    (5,  '3300 Wilson Blvd, Arlington, VA 22201'),
    (6,  '1775 Tysons Blvd, McLean, VA 22102'),
    (7,  '4807 Bethesda Ave, Bethesda, MD 20814'),
    (8,  '1200 19th St NW, Washington, DC 20036'),
    (9,  '655 15th St NW, Washington, DC 20005'),
    (10, '2500 Wisconsin Ave NW, Washington, DC 20007')
)
UPDATE helloworldjunktest.singles s
SET
  mailing_street = a.mailing_street,
  updated_at = CURRENT_TIMESTAMP
FROM ranked r
JOIN addrs a ON a.rn = ((r.rn - 1) % 10) + 1
WHERE s.singles_id = r.singles_id;

SELECT singles_id, email, mailing_firstname, mailing_lastname,
  dl_firstname, dl_middlename, dl_lastname, mailing_street
FROM helloworldjunktest.singles
WHERE member_category = 'DemoUser'
ORDER BY singles_id;

COMMIT;
