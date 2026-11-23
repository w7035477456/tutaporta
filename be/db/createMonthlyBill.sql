-- monthly_bill — forever per-month bill lines for TutaNotes Bill Schedule (Monthly).
-- Status is NOT stored; derive in app from action + due_day + calendar.
-- Clone-on-first-open: copy prior month's description/due_day/amount/bill_type/row_index;
-- leave action and paid_record_id NULL for the new month.
--
-- Run (Mac tunnel example):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createMonthlyBill.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.monthly_bill (
  monthly_bill_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  storage_backend text NOT NULL DEFAULT 'tutaCloud'
    CHECK (storage_backend IN ('tutaCloud', 'usb')),
  tab_label text NOT NULL DEFAULT 'home1',
  soft_delete boolean NOT NULL DEFAULT false,
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
    CHECK (bill_type IN ('Auto', 'Manual', 'Paid Off')),
  -- Manual only; Auto / Paid Off always NULL. Values: NULL | 'Not Paid' | 'Paid'
  action text NULL
    CHECK (action IS NULL OR action IN ('Not Paid', 'Paid')),
  -- Future FK to paid_record (table not created yet)
  paid_record_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_bill_singles_storage_tab_ym_row_uniq
    UNIQUE (singles_id, storage_backend, tab_label, bill_year, bill_month, row_index)
);

CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_tab_ym
  ON outdateddbsnapshotoct2024.monthly_bill (
    singles_id, storage_backend, tab_label, bill_year DESC, bill_month DESC
  );

CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_soft_delete
  ON outdateddbsnapshotoct2024.monthly_bill (singles_id, storage_backend, soft_delete, tab_label);

COMMENT ON TABLE outdateddbsnapshotoct2024.monthly_bill IS
  'TutaNotes Bill Schedule Monthly rows; forever slices per (singles_id, tab_label, year, month).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.tab_label IS
  'Bill Schedule tab name (default home1; user-renamable).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.soft_delete IS
  'true = tab hidden; restore via Undelete Tabs.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.bill_year IS
  'Calendar year of this history slice (e.g. 2026).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.bill_month IS
  'Calendar month 1–12 of this history slice.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.row_index IS
  'Display # within the month (1, 2, 3…).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.bill_type IS
  'Auto | Manual | Paid Off. Paid Off = bill closed; UI greys the entire row; action is NULL.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.action IS
  'Manual only: Not Paid / Paid. NULL for Auto, Paid Off, or unset. Not cloned to next month.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.paid_record_id IS
  'Optional FK to future paid_record when Action=Paid is clicked; no constraint yet.';

-- Verify:
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'outdateddbsnapshotoct2024' AND table_name = 'monthly_bill'
--  ORDER BY ordinal_position;
