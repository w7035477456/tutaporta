-- email_outbox — async queue for every outgoing email (be/lib/outboundMail.js enqueues,
-- be/lib/emailOutboxWorker.js sends). Every BE process on every web server runs a worker;
-- FOR UPDATE SKIP LOCKED on the Primary makes sure each row is claimed by exactly one of them.
-- Run:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createEmailOutbox.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.email_outbox (
  id bigserial PRIMARY KEY,
  mail_options jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending_run_at
  ON outdateddbsnapshotoct2024.email_outbox (run_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_outbox_sending_locked_at
  ON outdateddbsnapshotoct2024.email_outbox (locked_at)
  WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS idx_email_outbox_sent_at
  ON outdateddbsnapshotoct2024.email_outbox (sent_at)
  WHERE status = 'sent';

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_outbox_dedupe_key
  ON outdateddbsnapshotoct2024.email_outbox (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON TABLE outdateddbsnapshotoct2024.email_outbox IS
  'Async outgoing email queue; claimed by BE workers on the Primary with FOR UPDATE SKIP LOCKED.';
