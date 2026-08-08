-- helloworldjunktest.singles.is_login — backend gatekeeper session flag (Primary only).
-- true while user has an active server-side login; false after idle logout or explicit logout.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'boolean_enum'
  ) THEN
    CREATE TYPE helloworldjunktest.boolean_enum AS ENUM ('true', 'false');
  END IF;
END $$;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS is_login helloworldjunktest.boolean_enum NOT NULL
  DEFAULT 'false'::helloworldjunktest.boolean_enum;

COMMENT ON COLUMN helloworldjunktest.singles.is_login IS
  'Backend gatekeeper: true while session is active (login / API activity). Idle logout sets false.';
