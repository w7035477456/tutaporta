-- subscription_bill — forever per-month subscription lines for TutaNotes Bill Schedule (Subscription).
-- Same shape as monthly_bill; own table so Monthly and Subscription stay independent.
-- Status is NOT stored; derive in app from action + due_day + calendar.
-- Clone-on-first-open: copy prior month's description/due_day/amount/bill_type/row_index;
-- leave action and paid_record_id NULL for the new month.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createSubscriptionBill.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/createSubscriptionBill.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.subscription_bill (
  subscription_bill_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  storage_backend text NOT NULL DEFAULT 'tutaCloud'
    CHECK (storage_backend IN ('tutaCloud', 'usb')),
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
  paid_record_id bigint NULL,
  bill_icon text NULL,
  email_scan_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_bill_singles_storage_ym_row_uniq
    UNIQUE (singles_id, storage_backend, bill_year, bill_month, row_index)
);

CREATE INDEX IF NOT EXISTS idx_subscription_bill_singles_storage_ym
  ON outdateddbsnapshotoct2024.subscription_bill (singles_id, storage_backend, bill_year DESC, bill_month DESC);

COMMENT ON TABLE outdateddbsnapshotoct2024.subscription_bill IS
  'TutaNotes Bill Schedule Subscription rows; one forever slice per (singles_id, year, month).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.bill_year IS
  'Calendar year of this history slice (e.g. 2026).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.bill_month IS
  'Calendar month 1–12 of this history slice.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.row_index IS
  'Display # within the month (1, 2, 3…).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.bill_type IS
  'Auto | Manual | Paid Off. Paid Off = bill closed; UI greys the entire row; action is NULL.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.action IS
  'Manual only: Not Paid / Paid. NULL for Auto, Paid Off, or unset. Not cloned to next month.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.paid_record_id IS
  'Optional FK to paid_record when Bills/Receipts content exists for this row.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.bill_icon IS
  'Icon name picked for this Subscription bill row (security icon set). NULL = not chosen ("?").';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.email_scan_pending IS
  'True while row came from Auto Scan Emails and is not yet Approved.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.storage_backend IS
  'Vault side: tutaCloud or usb.';
