-- Bill Schedule: scope monthly/yearly rows per vault side (Cloud=onedrive | USB=usb)
-- so Cloud↔USB drag copy/move can keep separate histories.
--
-- Run (Mac tunnel):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/alterBillScheduleStorageBackend.sql

ALTER TABLE helloworldjunktest.monthly_bill
  ADD COLUMN IF NOT EXISTS storage_backend text NOT NULL DEFAULT 'onedrive';

ALTER TABLE helloworldjunktest.monthly_bill
  DROP CONSTRAINT IF EXISTS monthly_bill_storage_backend_check;

ALTER TABLE helloworldjunktest.monthly_bill
  ADD CONSTRAINT monthly_bill_storage_backend_check
  CHECK (storage_backend IN ('onedrive', 'usb'));

ALTER TABLE helloworldjunktest.monthly_bill
  DROP CONSTRAINT IF EXISTS monthly_bill_singles_ym_row_uniq;

ALTER TABLE helloworldjunktest.monthly_bill
  ADD CONSTRAINT monthly_bill_singles_storage_ym_row_uniq
  UNIQUE (singles_id, storage_backend, bill_year, bill_month, row_index);

DROP INDEX IF EXISTS helloworldjunktest.idx_monthly_bill_singles_ym;
CREATE INDEX IF NOT EXISTS idx_monthly_bill_singles_storage_ym
  ON helloworldjunktest.monthly_bill (singles_id, storage_backend, bill_year DESC, bill_month DESC);

ALTER TABLE helloworldjunktest.yearly_bill
  ADD COLUMN IF NOT EXISTS storage_backend text NOT NULL DEFAULT 'onedrive';

ALTER TABLE helloworldjunktest.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_storage_backend_check;

ALTER TABLE helloworldjunktest.yearly_bill
  ADD CONSTRAINT yearly_bill_storage_backend_check
  CHECK (storage_backend IN ('onedrive', 'usb'));

-- yearly unique name may differ — drop common variants then add scoped unique
ALTER TABLE helloworldjunktest.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_singles_y_row_uniq;
ALTER TABLE helloworldjunktest.yearly_bill
  DROP CONSTRAINT IF EXISTS yearly_bill_singles_year_row_uniq;

ALTER TABLE helloworldjunktest.yearly_bill
  ADD CONSTRAINT yearly_bill_singles_storage_y_row_uniq
  UNIQUE (singles_id, storage_backend, bill_year, row_index);

DROP INDEX IF EXISTS helloworldjunktest.idx_yearly_bill_singles_y;
CREATE INDEX IF NOT EXISTS idx_yearly_bill_singles_storage_y
  ON helloworldjunktest.yearly_bill (singles_id, storage_backend, bill_year DESC);

COMMENT ON COLUMN helloworldjunktest.monthly_bill.storage_backend IS
  'Vault side: onedrive (TutaDrive/OneDrive Cloud) or usb.';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.storage_backend IS
  'Vault side: onedrive (TutaDrive/OneDrive Cloud) or usb.';
