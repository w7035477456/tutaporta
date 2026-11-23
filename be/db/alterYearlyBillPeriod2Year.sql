-- yearly_bill: Period choice "2Year" (UI label "2-year") + due_year for year+month+day due dates.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterYearlyBillPeriod2Year.sql
-- Ubuntu (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterYearlyBillPeriod2Year.sql

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD COLUMN IF NOT EXISTS due_year integer;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_due_year_check;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD CONSTRAINT yearly_bill_due_year_check
  CHECK (due_year IS NULL OR (due_year >= 2000 AND due_year <= 2100));

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_bill_period_check;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD CONSTRAINT yearly_bill_bill_period_check
  CHECK (
    bill_period IS NULL
    OR bill_period IN ('Monthly', 'BiYearly', 'Quarterly', '2Year')
  );

COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.bill_period IS
  'Billing period: Monthly / BiYearly / Quarterly / 2Year (UI: 2-year). NULL = unset.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.due_year IS
  'Due calendar year when bill_period=2Year (Due Date = year + month + day). NULL otherwise.';
