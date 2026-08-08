-- helloworldjunktest.singles.custom_logout_duration — per-user backend idle logout (minutes).
-- Default 60. Gatekeeper sweep uses this instead of LOGOUT_AFTER_MINUTES_BE.

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS custom_logout_duration SMALLINT NOT NULL DEFAULT 60;

COMMENT ON COLUMN helloworldjunktest.singles.custom_logout_duration IS
  'Backend gatekeeper idle timeout in minutes (user preference from Profiles).';
