-- Clone Bill Schedule Monthly + Yearly sample rows from dm2@gmail.com to every account
-- that has none yet (all member_category). Matches the TutaNotes Bill Schedule demo.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/seedBillScheduleAllMembers.sql
--
-- Idempotent: skips members who already have any monthly_bill / yearly_bill rows.

BEGIN;

CREATE TEMP TABLE bill_schedule_source ON COMMIT DROP AS
SELECT s.singles_id
  FROM helloworldjunktest.singles s
 WHERE lower(s.email::text) = 'dm2@gmail.com'
 LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bill_schedule_source) THEN
    RAISE EXCEPTION 'Source account dm2@gmail.com not found';
  END IF;
END $$;

-- dm2 month with the fullest sample set (typically 4 rows)
CREATE TEMP TABLE monthly_template ON COMMIT DROP AS
WITH source AS (
  SELECT singles_id FROM bill_schedule_source
),
best_month AS (
  SELECT m.bill_year, m.bill_month
    FROM helloworldjunktest.monthly_bill m
    JOIN source s ON m.singles_id = s.singles_id
   WHERE m.storage_backend = 'onedrive'
   GROUP BY m.bill_year, m.bill_month
   ORDER BY COUNT(*) DESC, m.bill_year DESC, m.bill_month DESC
   LIMIT 1
)
SELECT
  m.row_index,
  m.bill_description,
  m.due_day,
  m.amount,
  m.bill_type,
  m.action
  FROM helloworldjunktest.monthly_bill m
  JOIN source s ON m.singles_id = s.singles_id
  JOIN best_month b ON b.bill_year = m.bill_year AND b.bill_month = m.bill_month
 WHERE m.storage_backend = 'onedrive'
 ORDER BY m.row_index;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM monthly_template) THEN
    RAISE EXCEPTION 'No monthly_bill template rows found for dm2@gmail.com';
  END IF;
END $$;

-- dm2 year with the fullest sample set (typically 6 rows)
CREATE TEMP TABLE yearly_template ON COMMIT DROP AS
WITH source AS (
  SELECT singles_id FROM bill_schedule_source
),
best_year AS (
  SELECT m.bill_year
    FROM helloworldjunktest.yearly_bill m
    JOIN source s ON m.singles_id = s.singles_id
   WHERE m.storage_backend = 'onedrive'
   GROUP BY m.bill_year
   ORDER BY COUNT(*) DESC, m.bill_year DESC
   LIMIT 1
)
SELECT
  m.row_index,
  m.bill_description,
  m.bill_month,
  m.due_month_day,
  m.amount,
  m.bill_type,
  m.action
  FROM helloworldjunktest.yearly_bill m
  JOIN source s ON m.singles_id = s.singles_id
  JOIN best_year b ON b.bill_year = m.bill_year
 WHERE m.storage_backend = 'onedrive'
 ORDER BY m.row_index;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM yearly_template) THEN
    RAISE EXCEPTION 'No yearly_bill template rows found for dm2@gmail.com';
  END IF;
END $$;

INSERT INTO helloworldjunktest.monthly_bill (
  singles_id,
  storage_backend,
  bill_year,
  bill_month,
  row_index,
  bill_description,
  due_day,
  amount,
  bill_type,
  action,
  paid_record_id
)
SELECT
  tgt.singles_id,
  sb.storage_backend,
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  EXTRACT(MONTH FROM CURRENT_DATE)::int,
  t.row_index,
  t.bill_description,
  t.due_day,
  t.amount,
  t.bill_type,
  t.action,
  NULL
  FROM helloworldjunktest.singles tgt
 CROSS JOIN (VALUES ('onedrive'), ('usb')) AS sb(storage_backend)
 CROSS JOIN monthly_template t
 WHERE NOT EXISTS (
         SELECT 1
           FROM helloworldjunktest.monthly_bill m
          WHERE m.singles_id = tgt.singles_id
       )
ON CONFLICT (singles_id, storage_backend, bill_year, bill_month, row_index) DO NOTHING;

INSERT INTO helloworldjunktest.yearly_bill (
  singles_id,
  storage_backend,
  bill_year,
  bill_month,
  row_index,
  bill_description,
  due_month_day,
  amount,
  bill_type,
  action,
  paid_record_id
)
SELECT
  tgt.singles_id,
  sb.storage_backend,
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  t.bill_month,
  t.row_index,
  t.bill_description,
  t.due_month_day,
  t.amount,
  t.bill_type,
  t.action,
  NULL
  FROM helloworldjunktest.singles tgt
 CROSS JOIN (VALUES ('onedrive'), ('usb')) AS sb(storage_backend)
 CROSS JOIN yearly_template t
 WHERE NOT EXISTS (
         SELECT 1
           FROM helloworldjunktest.yearly_bill y
          WHERE y.singles_id = tgt.singles_id
       )
ON CONFLICT (singles_id, storage_backend, bill_year, row_index) DO NOTHING;

COMMIT;

-- Verify:
-- SELECT s.email, COUNT(m.*) AS monthly_rows, COUNT(y.*) AS yearly_rows
--   FROM helloworldjunktest.singles s
--   LEFT JOIN helloworldjunktest.monthly_bill m ON m.singles_id = s.singles_id
--   LEFT JOIN helloworldjunktest.yearly_bill y ON y.singles_id = s.singles_id
--  GROUP BY s.singles_id, s.email
--  ORDER BY monthly_rows DESC, yearly_rows DESC;
