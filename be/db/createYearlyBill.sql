-- yearly_bill — forever per-year bill lines for TutaNotes Bill Schedule (Yearly).
-- Status is NOT stored; derive in app from action + due month/day + calendar.
-- Clone-on-first-open: copy prior year's description/bill_month/due_month_day/amount/bill_type/row_index;
-- leave action and paid_record_id NULL for the new year.
--
-- due date = bill_month (1–12) + due_month_day (1–31).
--
-- Run (Mac tunnel example):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/createYearlyBill.sql

CREATE TABLE IF NOT EXISTS helloworldjunktest.yearly_bill (
  yearly_bill_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  bill_year integer NOT NULL
    CHECK (bill_year >= 2000 AND bill_year <= 2100),
  -- Due month within the year (1–12)
  bill_month integer NULL
    CHECK (bill_month IS NULL OR (bill_month >= 1 AND bill_month <= 12)),
  row_index integer NOT NULL
    CHECK (row_index >= 1),
  bill_description text NOT NULL DEFAULT '',
  -- Due day within bill_month (1–31); paired with bill_month as due_month_day
  due_month_day integer NULL
    CHECK (due_month_day IS NULL OR (due_month_day >= 1 AND due_month_day <= 31)),
  amount text NOT NULL DEFAULT '',
  bill_type text NOT NULL DEFAULT 'Manual'
    CHECK (bill_type IN ('Auto', 'Manual')),
  action text NULL
    CHECK (action IS NULL OR action IN ('Not Paid', 'Paid')),
  paid_record_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yearly_bill_singles_year_row_uniq
    UNIQUE (singles_id, bill_year, row_index)
);

CREATE INDEX IF NOT EXISTS idx_yearly_bill_singles_year
  ON helloworldjunktest.yearly_bill (singles_id, bill_year DESC);

COMMENT ON TABLE helloworldjunktest.yearly_bill IS
  'TutaNotes Bill Schedule Yearly rows; one forever slice per (singles_id, bill_year).';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.bill_year IS
  'Calendar year of this history slice (cloned forward without action/paid_record_id).';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.bill_month IS
  'Due month 1–12 within the year.';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.due_month_day IS
  'Due day 1–31 within bill_month (due_month_day).';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.action IS
  'Manual only: Not Paid / Paid. NULL for Auto or unset. Not cloned to next year.';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.paid_record_id IS
  'Optional FK to future paid_record; no constraint yet.';

-- Verify:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'helloworldjunktest' AND table_name = 'yearly_bill'
--  ORDER BY ordinal_position;
