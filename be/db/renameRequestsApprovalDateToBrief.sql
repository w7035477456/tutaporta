-- outdateddbsnapshotoct2024.requests: approval_date → brief_approval_date (run on Primary only)
-- Set when user submits Brief Bio consent and approval is recorded as approve.

ALTER TABLE outdateddbsnapshotoct2024.requests
  RENAME COLUMN approval_date TO brief_approval_date;
