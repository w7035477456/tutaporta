-- yearly_bill: add Period choice "Yearly" (month + day, every year — same due-date shape as BiYearly/Quarterly).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterYearlyBillPeriodYearly.sql
-- Ubuntu (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterYearlyBillPeriodYearly.sql

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_bill_period_check;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD CONSTRAINT yearly_bill_bill_period_check
  CHECK (
    bill_period IS NULL
    OR bill_period IN ('Monthly', 'Yearly', 'BiYearly', 'Quarterly', '2Year')
  );

COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.bill_period IS
  'Billing period: Monthly / Yearly / BiYearly / Quarterly / 2Year (UI: 2-year). NULL = unset.';
