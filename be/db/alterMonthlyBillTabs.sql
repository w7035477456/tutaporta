-- monthly_bill tabs: tab_label + soft_delete (1:many tabs per singles via same table).
-- Existing rows backfill to tab_label='home1', soft_delete=false.
-- Unique key gains tab_label so each tab has its own row_index space per month.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterMonthlyBillTabs.sql
-- Ubuntu (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterMonthlyBillTabs.sql

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD COLUMN IF NOT EXISTS tab_label text;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD COLUMN IF NOT EXISTS soft_delete boolean;

UPDATE outdateddbsnapshotoct2024.monthly_bill
   SET tab_label = 'home1'
 WHERE tab_label IS NULL OR btrim(tab_label) = '';

UPDATE outdateddbsnapshotoct2024.monthly_bill
   SET soft_delete = false
 WHERE soft_delete IS NULL;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ALTER COLUMN tab_label SET DEFAULT 'home1';

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ALTER COLUMN tab_label SET NOT NULL;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ALTER COLUMN soft_delete SET DEFAULT false;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ALTER COLUMN soft_delete SET NOT NULL;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  DROP CONSTRAINT IF EXISTS monthly_bill_singles_storage_ym_row_uniq;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  DROP CONSTRAINT IF EXISTS monthly_bill_singles_storage_tab_ym_row_uniq;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD CONSTRAINT monthly_bill_singles_storage_tab_ym_row_uniq
  UNIQUE (singles_id, storage_backend, tab_label, bill_year, bill_month, row_index);

DROP INDEX IF EXISTS outdateddbsnapshotoct2024.idx_monthly_bill_singles_storage_ym;

CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_tab_ym
  ON outdateddbsnapshotoct2024.monthly_bill (
    singles_id, storage_backend, tab_label, bill_year DESC, bill_month DESC
  );

CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_soft_delete
  ON outdateddbsnapshotoct2024.monthly_bill (singles_id, storage_backend, soft_delete, tab_label);

COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.tab_label IS
  'Bill Schedule tab name for this row (default home1; user-renamable e.g. Medford).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.soft_delete IS
  'true = tab removed from UI; restore via Undelete Tabs (all months for that tab_label).';
