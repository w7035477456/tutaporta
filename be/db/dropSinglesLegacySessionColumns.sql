-- Remove legacy Postgres session columns (unified Redis v1:session:{singles_id} is source of truth).
-- Run on Primary only.

ALTER TABLE helloworldjunktest.singles
  DROP COLUMN IF EXISTS active_session_id,
  DROP COLUMN IF EXISTS active_session_started_at,
  DROP COLUMN IF EXISTS is_login;
