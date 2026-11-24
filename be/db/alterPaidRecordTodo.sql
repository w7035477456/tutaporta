-- Bills/Receipts for ToDo tasks: paid_record.schedule_kind 'todo' + todo_item.paid_record_id.
-- A 'todo' paid_record links to no bill table; todo_item.paid_record_id points at it.
-- Requires: createPaidRecord.sql, alterPaidRecordSubscription.sql, createTodoItem.sql.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterPaidRecordTodo.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterPaidRecordTodo.sql

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  DROP CONSTRAINT IF EXISTS paid_record_schedule_kind_check;

ALTER TABLE outdateddbsnapshotoct2024.paid_record
  ADD CONSTRAINT paid_record_schedule_kind_check
  CHECK (schedule_kind IN ('monthly', 'yearly', 'subscription', 'todo'));

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
    OR (schedule_kind = 'todo'
      AND monthly_bill_id IS NULL
      AND yearly_bill_id IS NULL
      AND subscription_bill_id IS NULL)
  );

ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD COLUMN IF NOT EXISTS paid_record_id bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'todo_item_paid_record_id_fkey'
       AND conrelid = 'outdateddbsnapshotoct2024.todo_item'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.todo_item
      ADD CONSTRAINT todo_item_paid_record_id_fkey
      FOREIGN KEY (paid_record_id)
      REFERENCES outdateddbsnapshotoct2024.paid_record (paid_record_id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.paid_record.schedule_kind IS
  'monthly | yearly | subscription | todo — which table this record links to (todo: via todo_item.paid_record_id).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.paid_record_id IS
  'Bills/Receipts (notes + attachments) for this ToDo task, opened from the paperclip.';
