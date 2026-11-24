-- Rewrite yearly_bill so column order matches Mac (bill_period/bill_source before tab_label).
-- Postgres cannot reorder columns in place; isdbsame reports this as a table difference.
-- Idempotent: no-op when bill_period already precedes tab_label.
--
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/reorderYearlyBillColumnsMacParity.sql

DO $$
DECLARE
  period_ord integer;
  tab_ord integer;
BEGIN
  SELECT a.attnum INTO period_ord
    FROM pg_attribute a
   WHERE a.attrelid = 'outdateddbsnapshotoct2024.yearly_bill'::regclass
     AND a.attname = 'bill_period'
     AND NOT a.attisdropped;

  SELECT a.attnum INTO tab_ord
    FROM pg_attribute a
   WHERE a.attrelid = 'outdateddbsnapshotoct2024.yearly_bill'::regclass
     AND a.attname = 'tab_label'
     AND NOT a.attisdropped;

  IF period_ord IS NOT NULL AND tab_ord IS NOT NULL AND period_ord < tab_ord THEN
    RAISE NOTICE 'yearly_bill column order already matches Mac — skipping rewrite';
    RETURN;
  END IF;

  -- No DEFAULT on yearly_bill_id yet — that would pin the shared sequence to both tables
  -- and block DROP of the old table.
  CREATE TABLE outdateddbsnapshotoct2024.yearly_bill__mac_order (
    yearly_bill_id bigint NOT NULL,
    singles_id bigint NOT NULL,
    bill_year integer NOT NULL,
    bill_month integer NULL,
    row_index integer NOT NULL,
    bill_description text NOT NULL DEFAULT ''::text,
    due_month_day integer NULL,
    amount text NOT NULL DEFAULT ''::text,
    bill_type text NOT NULL DEFAULT 'Manual'::text,
    action text NULL,
    paid_record_id bigint NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    storage_backend text NOT NULL DEFAULT 'tutaCloud'::text,
    bill_icon text NULL,
    email_scan_pending boolean NOT NULL DEFAULT false,
    bill_period text NULL,
    bill_source text NULL,
    tab_label text NOT NULL DEFAULT 'home1'::text,
    soft_delete boolean NOT NULL DEFAULT false,
    due_year integer NULL,
    CONSTRAINT yearly_bill__mac_order_pkey PRIMARY KEY (yearly_bill_id),
    CONSTRAINT yearly_bill__mac_order_singles_storage_tab_y_row_uniq
      UNIQUE (singles_id, storage_backend, tab_label, bill_year, row_index),
    CONSTRAINT yearly_bill__mac_order_action_check
      CHECK (action IS NULL OR action = ANY (ARRAY['Not Paid'::text, 'Paid'::text])),
    CONSTRAINT yearly_bill__mac_order_bill_month_check
      CHECK (bill_month IS NULL OR (bill_month >= 1 AND bill_month <= 12)),
    CONSTRAINT yearly_bill__mac_order_bill_period_check
      CHECK (bill_period IS NULL OR bill_period = ANY (ARRAY['Monthly'::text, 'Yearly'::text, 'BiYearly'::text, 'Quarterly'::text, '2Year'::text])),
    CONSTRAINT yearly_bill__mac_order_bill_source_check
      CHECK (bill_source IS NULL OR bill_source = ANY (ARRAY['Visa'::text, 'Check'::text, 'Other'::text])),
    CONSTRAINT yearly_bill__mac_order_bill_type_check
      CHECK (bill_type = ANY (ARRAY['Auto'::text, 'Manual'::text])),
    CONSTRAINT yearly_bill__mac_order_bill_year_check
      CHECK (bill_year >= 2000 AND bill_year <= 2100),
    CONSTRAINT yearly_bill__mac_order_due_month_day_check
      CHECK (due_month_day IS NULL OR (due_month_day >= 1 AND due_month_day <= 31)),
    CONSTRAINT yearly_bill__mac_order_due_year_check
      CHECK (due_year IS NULL OR (due_year >= 2000 AND due_year <= 2100)),
    CONSTRAINT yearly_bill__mac_order_row_index_check
      CHECK (row_index >= 1),
    CONSTRAINT yearly_bill__mac_order_storage_backend_chk
      CHECK (storage_backend = ANY (ARRAY['tutaCloud'::text, 'usb'::text]))
  );

  INSERT INTO outdateddbsnapshotoct2024.yearly_bill__mac_order (
    yearly_bill_id, singles_id, bill_year, bill_month, row_index, bill_description,
    due_month_day, amount, bill_type, action, paid_record_id, created_at, updated_at,
    storage_backend, bill_icon, email_scan_pending, bill_period, bill_source,
    tab_label, soft_delete, due_year
  )
  SELECT
    yearly_bill_id, singles_id, bill_year, bill_month, row_index, bill_description,
    due_month_day, amount, bill_type, action, paid_record_id, created_at, updated_at,
    storage_backend, bill_icon, email_scan_pending, bill_period, bill_source,
    tab_label, soft_delete, due_year
  FROM outdateddbsnapshotoct2024.yearly_bill;

  ALTER TABLE outdateddbsnapshotoct2024.paid_record
    DROP CONSTRAINT IF EXISTS paid_record_yearly_bill_id_fkey;

  ALTER SEQUENCE outdateddbsnapshotoct2024.yearly_bill_yearly_bill_id_seq OWNED BY NONE;

  DROP TABLE outdateddbsnapshotoct2024.yearly_bill;

  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill__mac_order
    RENAME TO yearly_bill;

  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    ALTER COLUMN yearly_bill_id
    SET DEFAULT nextval('outdateddbsnapshotoct2024.yearly_bill_yearly_bill_id_seq'::regclass);

  ALTER SEQUENCE outdateddbsnapshotoct2024.yearly_bill_yearly_bill_id_seq
    OWNED BY outdateddbsnapshotoct2024.yearly_bill.yearly_bill_id;

  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_pkey TO yearly_bill_pkey;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_singles_storage_tab_y_row_uniq
      TO yearly_bill_singles_storage_tab_y_row_uniq;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_action_check TO yearly_bill_action_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_bill_month_check TO yearly_bill_bill_month_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_bill_period_check TO yearly_bill_bill_period_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_bill_source_check TO yearly_bill_bill_source_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_bill_type_check TO yearly_bill_bill_type_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_bill_year_check TO yearly_bill_bill_year_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_due_month_day_check TO yearly_bill_due_month_day_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_due_year_check TO yearly_bill_due_year_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_row_index_check TO yearly_bill_row_index_check;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    RENAME CONSTRAINT yearly_bill__mac_order_storage_backend_chk TO yearly_bill_storage_backend_chk;

  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    ADD CONSTRAINT yearly_bill_singles_id_fkey
    FOREIGN KEY (singles_id) REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE;
  ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
    ADD CONSTRAINT yearly_bill_paid_record_id_fkey
    FOREIGN KEY (paid_record_id) REFERENCES outdateddbsnapshotoct2024.paid_record (paid_record_id) ON DELETE SET NULL;
  ALTER TABLE outdateddbsnapshotoct2024.paid_record
    ADD CONSTRAINT paid_record_yearly_bill_id_fkey
    FOREIGN KEY (yearly_bill_id) REFERENCES outdateddbsnapshotoct2024.yearly_bill (yearly_bill_id) ON DELETE SET NULL;

  CREATE INDEX idx_yearly_bill_singles_storage_soft_delete
    ON outdateddbsnapshotoct2024.yearly_bill (singles_id, storage_backend, soft_delete, tab_label);
  CREATE INDEX idx_yearly_bill_singles_storage_tab_y
    ON outdateddbsnapshotoct2024.yearly_bill (singles_id, storage_backend, tab_label, bill_year DESC);
  CREATE INDEX idx_yearly_bill_singles_year
    ON outdateddbsnapshotoct2024.yearly_bill (singles_id, bill_year DESC);

  PERFORM setval(
    'outdateddbsnapshotoct2024.yearly_bill_yearly_bill_id_seq',
    COALESCE((SELECT MAX(yearly_bill_id) FROM outdateddbsnapshotoct2024.yearly_bill), 1),
    true
  );
END $$;
