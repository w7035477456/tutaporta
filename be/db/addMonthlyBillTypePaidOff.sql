-- Monthly Bill Schedule: allow Type = 'Paid Off' (entire row grey in UI).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addMonthlyBillTypePaidOff.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/addMonthlyBillTypePaidOff.sql

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  DROP CONSTRAINT IF EXISTS monthly_bill_bill_type_check;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD CONSTRAINT monthly_bill_bill_type_check
  CHECK (bill_type IN ('Auto', 'Manual', 'Paid Off'));

COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.bill_type IS
  'Auto | Manual | Paid Off. Paid Off = bill closed; UI greys the entire row; action is NULL.';
