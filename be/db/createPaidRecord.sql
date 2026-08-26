-- paid_record + paid_record_attachment — Bills/Receipts for TutaNotes Bill Schedule.
-- Also extends mobile_photo_upload_sessions with paid_record_id for phone QR uploads.
--
-- Run (Mac tunnel):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/createPaidRecord.sql

CREATE TABLE IF NOT EXISTS helloworldjunktest.paid_record (
  paid_record_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  schedule_kind text NOT NULL
    CHECK (schedule_kind IN ('monthly', 'yearly')),
  -- Soft-linked to bill rows (SET NULL on bill delete so month/year SAVE replace can re-link).
  monthly_bill_id bigint NULL
    REFERENCES helloworldjunktest.monthly_bill (monthly_bill_id) ON DELETE SET NULL,
  yearly_bill_id bigint NULL
    REFERENCES helloworldjunktest.yearly_bill (yearly_bill_id) ON DELETE SET NULL,
  storage_backend text NOT NULL DEFAULT 'onedrive'
    CHECK (storage_backend IN ('onedrive', 'usb')),
  notes_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_record_kind_bill_fk_check
    CHECK (
      (schedule_kind = 'monthly' AND yearly_bill_id IS NULL)
      OR (schedule_kind = 'yearly' AND monthly_bill_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS paid_record_monthly_bill_uniq
  ON helloworldjunktest.paid_record (monthly_bill_id)
  WHERE monthly_bill_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS paid_record_yearly_bill_uniq
  ON helloworldjunktest.paid_record (yearly_bill_id)
  WHERE yearly_bill_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_paid_record_singles
  ON helloworldjunktest.paid_record (singles_id, schedule_kind);

COMMENT ON TABLE helloworldjunktest.paid_record IS
  'Bills/Receipts notes + metadata for one monthly_bill or yearly_bill row.';
COMMENT ON COLUMN helloworldjunktest.paid_record.notes_text IS
  'Free-text notes shown in the Bills/Receipts popup.';
COMMENT ON COLUMN helloworldjunktest.paid_record.schedule_kind IS
  'monthly | yearly — which bill table this record links to.';

CREATE TABLE IF NOT EXISTS helloworldjunktest.paid_record_attachment (
  paid_record_attachment_id bigserial PRIMARY KEY,
  paid_record_id bigint NOT NULL
    REFERENCES helloworldjunktest.paid_record (paid_record_id) ON DELETE CASCADE,
  singles_id bigint NOT NULL
    REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  original_file_name text NOT NULL DEFAULT '',
  stored_file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  byte_size bigint NOT NULL DEFAULT 0
    CHECK (byte_size >= 0),
  -- SHA-256 hex of file bytes (duplicate detection: size first, then checksum)
  checksum text NULL,
  -- Path relative to member notes mount (…/users/M{id}/notes/), e.g. bill_receipts/12/abc.pdf
  relative_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_record_attachment_record
  ON helloworldjunktest.paid_record_attachment (paid_record_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_paid_record_attachment_singles
  ON helloworldjunktest.paid_record_attachment (singles_id);

COMMENT ON TABLE helloworldjunktest.paid_record_attachment IS
  'Uploaded bill/receipt files stored under LARGE_CHEAP …/notes/bill_receipts/{paid_record_id}/.';
COMMENT ON COLUMN helloworldjunktest.paid_record_attachment.relative_path IS
  'Relative to tutaDrive notes mount; join with notes root for absolute path.';

-- Optional FKs from bill tables → paid_record (paid_record_id columns already exist).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'monthly_bill_paid_record_id_fkey'
       AND conrelid = 'helloworldjunktest.monthly_bill'::regclass
  ) THEN
    ALTER TABLE helloworldjunktest.monthly_bill
      ADD CONSTRAINT monthly_bill_paid_record_id_fkey
      FOREIGN KEY (paid_record_id)
      REFERENCES helloworldjunktest.paid_record (paid_record_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'yearly_bill_paid_record_id_fkey'
       AND conrelid = 'helloworldjunktest.yearly_bill'::regclass
  ) THEN
    ALTER TABLE helloworldjunktest.yearly_bill
      ADD CONSTRAINT yearly_bill_paid_record_id_fkey
      FOREIGN KEY (paid_record_id)
      REFERENCES helloworldjunktest.paid_record (paid_record_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN helloworldjunktest.monthly_bill.paid_record_id IS
  'FK to paid_record when Bills/Receipts content exists for this row.';
COMMENT ON COLUMN helloworldjunktest.yearly_bill.paid_record_id IS
  'FK to paid_record when Bills/Receipts content exists for this row.';

-- Phone QR upload sessions: link to paid_record for purpose=bill_receipt.
ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
  ADD COLUMN IF NOT EXISTS paid_record_id bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'mobile_photo_upload_sessions_paid_record_id_fkey'
       AND conrelid = 'helloworldjunktest.mobile_photo_upload_sessions'::regclass
  ) THEN
    ALTER TABLE helloworldjunktest.mobile_photo_upload_sessions
      ADD CONSTRAINT mobile_photo_upload_sessions_paid_record_id_fkey
      FOREIGN KEY (paid_record_id)
      REFERENCES helloworldjunktest.paid_record (paid_record_id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_mobile_photo_upload_sessions_paid_record
  ON helloworldjunktest.mobile_photo_upload_sessions (paid_record_id)
  WHERE paid_record_id IS NOT NULL;

COMMENT ON COLUMN helloworldjunktest.mobile_photo_upload_sessions.paid_record_id IS
  'When purpose=bill_receipt, target paid_record for phone-uploaded files.';
