-- helloworldjunktest.login_log — demo logins + new-account signups, with IP and online duration.
-- Run on Primary only. Safe to re-run.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addLoginLog.sql
--
-- Tracks:
--   1) demo/demo (and guest/guest) logins  → event_type = 'demo_login', is_demo = true
--   2) new account signup                 → event_type = 'signup', email + phone
--   For either: client_ip, login_at, logout_at, online_seconds, logout_reason
--     (explicit logout, idle/system auto-logout, or browser close / session end)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'login_log_event_type'
  ) THEN
    CREATE TYPE helloworldjunktest.login_log_event_type AS ENUM (
      'demo_login',
      'signup'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'login_log_logout_reason'
  ) THEN
    CREATE TYPE helloworldjunktest.login_log_logout_reason AS ENUM (
      'user_logout',
      'auto_logout',
      'browser_close',
      'session_superseded',
      'other'
    );
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS helloworldjunktest.login_log_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS helloworldjunktest.login_log (
  login_log_id bigint NOT NULL
    DEFAULT nextval('helloworldjunktest.login_log_id_seq'::regclass),

  -- demo_login | signup
  event_type helloworldjunktest.login_log_event_type NOT NULL,

  -- true for demo/demo (and guest/guest alias) sessions
  is_demo boolean NOT NULL DEFAULT false,

  -- member row when known (signup after insert; demo → shared demo singles_id)
  singles_id bigint,

  -- signup: new account email/phone; demo: resolved target account when useful
  email text,
  phone text,

  -- client / session
  client_ip inet,
  user_agent text,
  -- correlates JWT/Redis session_id when present (logout close-out)
  session_token text,

  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  -- filled on logout / auto-logout / browser-close detection
  online_seconds integer,
  logout_reason helloworldjunktest.login_log_logout_reason,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT login_log_pkey PRIMARY KEY (login_log_id),
  CONSTRAINT login_log_online_seconds_nonneg
    CHECK (online_seconds IS NULL OR online_seconds >= 0),
  CONSTRAINT login_log_logout_after_login
    CHECK (logout_at IS NULL OR logout_at >= login_at),
  CONSTRAINT login_log_signup_contact
    CHECK (
      event_type <> 'signup'
      OR (email IS NOT NULL AND length(trim(email)) > 0
          AND phone IS NOT NULL AND length(trim(phone)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS login_log_login_at_idx
  ON helloworldjunktest.login_log (login_at DESC);

CREATE INDEX IF NOT EXISTS login_log_event_type_idx
  ON helloworldjunktest.login_log (event_type, login_at DESC);

CREATE INDEX IF NOT EXISTS login_log_is_demo_idx
  ON helloworldjunktest.login_log (is_demo, login_at DESC)
  WHERE is_demo = true;

CREATE INDEX IF NOT EXISTS login_log_singles_id_idx
  ON helloworldjunktest.login_log (singles_id, login_at DESC);

CREATE INDEX IF NOT EXISTS login_log_email_idx
  ON helloworldjunktest.login_log (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS login_log_phone_idx
  ON helloworldjunktest.login_log (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS login_log_client_ip_idx
  ON helloworldjunktest.login_log (client_ip, login_at DESC)
  WHERE client_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS login_log_session_token_idx
  ON helloworldjunktest.login_log (session_token)
  WHERE session_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS login_log_open_sessions_idx
  ON helloworldjunktest.login_log (singles_id, login_at DESC)
  WHERE logout_at IS NULL;

COMMENT ON TABLE helloworldjunktest.login_log IS
  'Demo logins and new signups: IP + online duration until logout / auto-logout / browser close.';
COMMENT ON COLUMN helloworldjunktest.login_log.is_demo IS
  'True when login used demo/demo or guest/guest alias (guest_demo_login).';
COMMENT ON COLUMN helloworldjunktest.login_log.online_seconds IS
  'Seconds between login_at and logout_at; set when session ends.';
COMMENT ON COLUMN helloworldjunktest.login_log.logout_reason IS
  'user_logout | auto_logout (idle/system) | browser_close | session_superseded | other.';
