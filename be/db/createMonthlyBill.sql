-- monthly_bill — forever per-month bill lines for TutaNotes Bill Schedule (Monthly).
-- Status is NOT stored; derive in app from action + due_day + calendar.
-- Clone-on-first-open: copy prior month's description/due_day/amount/bill_type/row_index;
-- leave action and paid_record_id NULL for the new month.
--
-- Run (Mac tunnel example):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/createMonthlyBill.sql

CREATE TABLE IF NOT EXISTS helloworldjunktest.monthly_bill (
  monthly_bill_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  storage_backend text NOT NULL DEFAULT 'onedrive'
    CHECK (storage_backend IN ('onedrive', 'usb')),
  bill_year integer NOT NULL
    CHECK (bill_year >= 2000 AND bill_year <= 2100),
  bill_month integer NOT NULL
    CHECK (bill_month >= 1 AND bill_month <= 12),
  row_index integer NOT NULL
    CHECK (row_index >= 1),
  bill_description text NOT NULL DEFAULT '',
  due_day integer NULL
    CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  -- Display string: normalized "$#,###.##" or free text such as "Varied"
  amount text NOT NULL DEFAULT '',
  bill_type text NOT NULL DEFAULT 'Manual'
    CHECK (bill_type IN ('Auto', 'Manual')),
  -- Manual only; Auto always NULL. Values: NULL | 'Not Paid' | 'Paid'
  action text NULL
    CHECK (action IS NULL OR action IN ('Not Paid', 'Paid')),
  -- Future FK to paid_record (table not created yet)
  paid_record_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_bill_singles_storage_ym_row_uniq
    UNIQUE (singles_id, storage_backend, bill_year, bill_month, row_index)
);

CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_ym
  ON helloworldjunktest.monthly_bill (singles_id, storage_backend, bill_year DESC, bill_month DESC);

COMMENT ON TABLE helloworldjunktest.monthly_bill IS
  'TutaNotes Bill Schedule Monthly rows; one forever slice per (singles_id, year, month).';
COMMENT ON COLUMN helloworldjunktest.monthly_bill.bill_year IS
  'Calendar year of this history slice (e.g. 2026).';
COMMENT ON COLUMN helloworldjunktest.monthly_bill.bill_month IS
  'Calendar month 1–12 of this history slice.';
COMMENT ON COLUMN helloworldjunktest.monthly_bill.row_index IS
  'Display # within the month (1, 2, 3…).';
COMMENT ON COLUMN helloworldjunktest.monthly_bill.action IS
  'Manual only: Not Paid / Paid. NULL for Auto or unset. Not cloned to next month.';
COMMENT ON COLUMN helloworldjunktest.monthly_bill.paid_record_id IS
  'Optional FK to future paid_record when Action=Paid is clicked; no constraint yet.';

-- Verify:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'helloworldjunktest' AND table_name = 'monthly_bill'
--  ORDER BY ordinal_position;
