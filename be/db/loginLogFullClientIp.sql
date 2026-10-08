-- login_log.client_ip: store the full client IP (replaces the old last-digit-only privacy mask).
-- Older rows keep their 0.0.0.N value; Admin Tools shows those as x.x.x.N.
-- 127.0.0.1 and 72.83.247.73 are never logged (be/utils/ipLogSkipList.js).
-- Run on Primary only. Safe to re-run.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/loginLogFullClientIp.sql

ALTER TABLE outdateddbsnapshotoct2024.login_log
  DROP CONSTRAINT IF EXISTS login_log_client_ip_last_digit_only;

COMMENT ON TABLE outdateddbsnapshotoct2024.login_log IS
  'Demo logins and new signups: full client IP + online duration until logout / auto-logout / browser close. 127.0.0.1 and 72.83.247.73 are not logged.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.login_log.client_ip IS
  'Full client IP. Rows written before full-IP logging hold 0.0.0.N (last digit only), shown in Tools as x.x.x.N.';
