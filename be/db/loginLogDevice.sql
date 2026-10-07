-- login_log: Desktop / Mobile, browser, OS for each demo login / signup.
-- New rows are filled by be/utils/clientDeviceInfo.js; this backfills older rows from user_agent
-- with the same rules. Run on Primary only. Safe to re-run.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/loginLogDevice.sql

ALTER TABLE helloworldjunktest.login_log
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text;

UPDATE helloworldjunktest.login_log
SET device_type = CASE
      WHEN user_agent ~* '(Mobile|Android|iPhone|iPod|IEMobile|Opera Mini|webOS|BlackBerry|Windows Phone|iPad|Tablet|PlayBook|Silk)'
        THEN 'Mobile'
      ELSE 'Desktop'
    END,
    browser = CASE
      WHEN user_agent ~ 'Edg(e|A|iOS)?/' THEN 'Edge'
      WHEN user_agent ~ '(OPR/|OPiOS/|Opera)' THEN 'Opera'
      WHEN user_agent ~ 'SamsungBrowser/' THEN 'Samsung'
      WHEN user_agent ~ '(Firefox/|FxiOS/)' THEN 'Firefox'
      WHEN user_agent ~ '(Chrome/|CriOS/|Chromium/)' THEN 'Chrome'
      WHEN user_agent ~ 'Safari/' THEN 'Safari'
      ELSE 'Other'
    END,
    os = CASE
      WHEN user_agent ~ '(iPhone|iPad|iPod)' THEN 'iOS'
      WHEN user_agent ~ 'Android' THEN 'Android'
      WHEN user_agent ~ 'Windows' THEN 'Windows'
      WHEN user_agent ~ 'CrOS' THEN 'ChromeOS'
      WHEN user_agent ~ '(Macintosh|Mac OS X)' THEN 'Mac'
      WHEN user_agent ~ 'Ubuntu' THEN 'Ubuntu'
      WHEN user_agent ~ '(Linux|X11)' THEN 'Linux'
      ELSE 'Other'
    END
WHERE device_type IS NULL
  AND user_agent IS NOT NULL
  AND length(trim(user_agent)) > 0;

COMMENT ON COLUMN helloworldjunktest.login_log.device_type IS
  'Desktop | Mobile (phone or tablet) from User-Agent. iPadOS Safari reports as Mac → Desktop.';
COMMENT ON COLUMN helloworldjunktest.login_log.browser IS
  'Edge | Opera | Samsung | Firefox | Chrome | Safari | Other (from User-Agent).';
COMMENT ON COLUMN helloworldjunktest.login_log.os IS
  'iOS | Android | Windows | ChromeOS | Mac | Ubuntu | Linux | Other (from User-Agent).';
