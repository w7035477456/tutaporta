-- bill_overdue_email_log — at most one Bill Schedule overdue digest email per user per calendar day.
-- Run:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/createBillOverdueEmailLog.sql

CREATE TABLE IF NOT EXISTS helloworldjunktest.bill_overdue_email_log (
  singles_id bigint NOT NULL
    REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  sent_on date NOT NULL DEFAULT (CURRENT_DATE),
  monthly_overdue_count integer NOT NULL DEFAULT 0,
  yearly_overdue_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (singles_id, sent_on)
);

CREATE INDEX IF NOT EXISTS idx_bill_overdue_email_log_sent_on
  ON helloworldjunktest.bill_overdue_email_log (sent_on DESC);

COMMENT ON TABLE helloworldjunktest.bill_overdue_email_log IS
  'Ensures at most one Bill Schedule overdue email per singles_id per calendar day.';
