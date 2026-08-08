-- helloworldjunktest.requests full_approval_date (run on Primary only)
-- Set when user submits Full Bio consent and approval is recorded as approve.

ALTER TABLE helloworldjunktest.requests
  ADD COLUMN IF NOT EXISTS full_approval_date date;
