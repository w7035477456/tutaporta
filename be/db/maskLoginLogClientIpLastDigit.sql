-- Privacy: rewrite login_log.client_ip so only the last digit is kept (0.0.0.N).
-- Admin Tools Login Log displays these as x.x.x.N (e.g. x.x.x.5).
-- Run on Primary only. Safe to re-run.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/maskLoginLogClientIpLastDigit.sql

UPDATE helloworldjunktest.login_log
SET client_ip = NULL,
    updated_at = now()
WHERE client_ip IS NOT NULL
  AND regexp_replace(host(client_ip), '[^0-9]', '', 'g') = '';

UPDATE helloworldjunktest.login_log
SET client_ip = ('0.0.0.' || right(regexp_replace(host(client_ip), '[^0-9]', '', 'g'), 1))::inet,
    updated_at = now()
WHERE client_ip IS NOT NULL
  AND regexp_replace(host(client_ip), '[^0-9]', '', 'g') <> ''
  AND host(client_ip) IS DISTINCT FROM
      ('0.0.0.' || right(regexp_replace(host(client_ip), '[^0-9]', '', 'g'), 1));

ALTER TABLE helloworldjunktest.login_log
  DROP CONSTRAINT IF EXISTS login_log_client_ip_last_digit_only;

ALTER TABLE helloworldjunktest.login_log
  ADD CONSTRAINT login_log_client_ip_last_digit_only
  CHECK (
    client_ip IS NULL
    OR host(client_ip) ~ '^0\.0\.0\.[0-9]$'
  );

COMMENT ON COLUMN helloworldjunktest.login_log.client_ip IS
  'Privacy: only the final IP digit, stored as 0.0.0.N (e.g. 0.0.0.5) and shown in Tools as x.x.x.N. Never a full client address.';
