-- Auto Scan Emails (TutaNotes Bill Schedule).
-- Members forward bill emails to bills+<inbox_token>@tutamall.com (Google Workspace plus-addressing
-- delivers them to the bills@ mailbox). The BE reads that mailbox over IMAP, runs:
--   stage 1 keyword filter (no AI) → stage 2 local Ollama JSON extract → stage 3 cadence in code,
-- adds pending Monthly/Yearly rows (email_scan_pending = true) and DELETES the raw email.
-- Only the extracted fields below are kept; email bodies are never stored.
--
-- Run (Mac):    psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createEmailScan.sql
-- Run (Ubuntu): scripts/ubuntu-psql.sh -f be/db/createEmailScan.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.email_scan_inbox (
  singles_id bigint PRIMARY KEY
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  -- Random, unguessable; forms bills+<inbox_token>@tutamall.com
  inbox_token text NOT NULL UNIQUE
    CHECK (inbox_token ~ '^[a-z0-9]{8,32}$'),
  storage_backend text NOT NULL DEFAULT 'onedrive'
    CHECK (storage_backend IN ('onedrive', 'usb')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.email_scan (
  email_scan_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  -- sha256 of Message-ID + subject + body; dedupes re-forwarded mail
  content_hash text NOT NULL,
  from_address text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  received_at timestamptz NULL,
  stage text NOT NULL
    CHECK (stage IN ('filtered_out', 'not_bill', 'added', 'duplicate', 'gmail_confirm', 'error')),
  is_bill boolean NULL,
  merchant text NULL,
  amount numeric(12, 2) NULL,
  bill_date date NULL,
  due_date date NULL,
  kind text NULL,
  autopay boolean NULL,
  confidence numeric(4, 3) NULL,
  cadence text NULL
    CHECK (cadence IS NULL OR cadence IN ('monthly', 'yearly')),
  added_kind text NULL
    CHECK (added_kind IS NULL OR added_kind IN ('monthly', 'yearly')),
  added_year integer NULL,
  added_month integer NULL,
  llm_model text NULL,
  -- Gmail "Forwarding Confirmation" mail: shown to the member so they can finish Gmail setup
  gmail_confirm_code text NULL,
  gmail_confirm_url text NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_scan_singles_hash_uniq UNIQUE (singles_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_email_scan_singles_created
  ON outdateddbsnapshotoct2024.email_scan (singles_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_scan_singles_merchant
  ON outdateddbsnapshotoct2024.email_scan (singles_id, lower(merchant))
  WHERE is_bill IS TRUE;

ALTER TABLE outdateddbsnapshotoct2024.monthly_bill
  ADD COLUMN IF NOT EXISTS email_scan_pending boolean NOT NULL DEFAULT false;

ALTER TABLE outdateddbsnapshotoct2024.yearly_bill
  ADD COLUMN IF NOT EXISTS email_scan_pending boolean NOT NULL DEFAULT false;

COMMENT ON TABLE outdateddbsnapshotoct2024.email_scan_inbox IS
  'Per-member Auto Scan forwarding address token (bills+<inbox_token>@tutamall.com).';
COMMENT ON TABLE outdateddbsnapshotoct2024.email_scan IS
  'One row per forwarded email processed by Auto Scan; extracted fields only, raw email deleted.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.monthly_bill.email_scan_pending IS
  'true = row added by Auto Scan Emails and not yet approved (red dashed + Approve button).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.yearly_bill.email_scan_pending IS
  'true = row added by Auto Scan Emails and not yet approved (red dashed + Approve button).';
