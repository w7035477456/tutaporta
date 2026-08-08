-- helloworldjunktest.requests brief_approval_date (run on Primary only)
-- Set when user submits Brief Bio consent and approval is recorded as approve.

ALTER TABLE helloworldjunktest.requests
  ADD COLUMN IF NOT EXISTS brief_approval_date date;
