-- yearly_bill.bill_period / yearly_bill.bill_source — Period + Source dropdowns on Yearly Bill Schedule.
-- Period: Monthly | BiYearly | Quarterly | 2Year (see also alterYearlyBillPeriod2Year.sql).
-- Source: Visa | Check | Other. NULL = unset (Select).

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD COLUMN IF NOT EXISTS bill_period text NULL;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD COLUMN IF NOT EXISTS bill_source text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'yearly_bill_bill_period_check'
       AND conrelid = 'outdateddbsnapshotoct2024.yearly_bill'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
      ADD CONSTRAINT yearly_bill_bill_period_check
      CHECK (bill_period IS NULL OR bill_period IN ('Monthly', 'BiYearly', 'Quarterly', '2Year'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'yearly_bill_bill_source_check'
       AND conrelid = 'outdateddbsnapshotoct2024.yearly_bill'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
      ADD CONSTRAINT yearly_bill_bill_source_check
      CHECK (bill_source IS NULL OR bill_source IN ('Visa', 'Check', 'Other'));
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.bill_period IS
  'Billing period: Monthly / BiYearly / Quarterly / 2Year (UI: 2-year). NULL = unset.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.bill_source IS
  'Payment source: Visa / Check / Other. NULL = unset.';
