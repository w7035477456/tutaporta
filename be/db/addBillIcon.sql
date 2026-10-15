-- monthly_bill.bill_icon / yearly_bill.bill_icon — icon the member picked for a Bill Schedule row
-- (same Font Awesome name set as the security icon picker, e.g. 'car', 'home'). NULL shows "?".

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD COLUMN IF NOT EXISTS bill_icon text NULL;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD COLUMN IF NOT EXISTS bill_icon text NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.bill_icon IS
  'Icon name picked for this Monthly bill row (security icon set). NULL = not chosen ("?").';

COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.bill_icon IS
  'Icon name picked for this Yearly bill row (security icon set). NULL = not chosen ("?").';
