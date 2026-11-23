-- Extend paid_record for Bill Schedule Subscription (subscription_bill).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterPaidRecordSubscription.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterPaidRecordSubscription.sql

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  ADD COLUMN IF NOT EXISTS subscription_bill_id bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'paid_record_subscription_bill_id_fkey'
       AND conrelid = 'outdateddbsnapshotoct2024.paid_record'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.paid_record
      ADD CONSTRAINT paid_record_subscription_bill_id_fkey
      FOREIGN KEY (subscription_bill_id)
      REFERENCES outdateddbsnapshotoct2024.subscription_bill (subscription_bill_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  DROP CONSTRAINT IF EXISTS paid_record_schedule_kind_check;

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  ADD CONSTRAINT paid_record_schedule_kind_check
  CHECK (schedule_kind IN ('monthly', 'yearly', 'subscription'));

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  DROP CONSTRAINT IF EXISTS paid_record_kind_bill_fk_check;

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  ADD CONSTRAINT paid_record_kind_bill_fk_check
  CHECK (
    (schedule_kind = 'monthly'
      AND yearly_bill_id IS NULL
      AND subscription_bill_id IS NULL)
    OR (schedule_kind = 'yearly'
      AND monthly_bill_id IS NULL
      AND subscription_bill_id IS NULL)
    OR (schedule_kind = 'subscription'
      AND monthly_bill_id IS NULL
      AND yearly_bill_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS paid_record_subscription_bill_uniq
  ON outdateddbsnapshotoct2024.paid_record (subscription_bill_id)
  WHERE subscription_bill_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'subscription_bill_paid_record_id_fkey'
       AND conrelid = 'outdateddbsnapshotoct2024.subscription_bill'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.subscription_bill
      ADD CONSTRAINT subscription_bill_paid_record_id_fkey
      FOREIGN KEY (paid_record_id)
      REFERENCES outdateddbsnapshotoct2024.paid_record (paid_record_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.paid_record.subscription_bill_id IS
  'Soft link to subscription_bill when schedule_kind = subscription.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.paid_record.schedule_kind IS
  'monthly | yearly | subscription — which bill table this record links to.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.paid_record_id IS
  'FK to paid_record when Bills/Receipts content exists for this row.';
