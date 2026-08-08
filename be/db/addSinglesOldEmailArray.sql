-- helloworldjunktest.singles — prior email addresses with change timestamps (Primary only).
-- Nullable text[]: NULL = no history yet.
-- Each element encodes email + change time in one string:
--   "<email>|<changed_at ISO8601>"
-- Example: 'a7035477456@gmail.com|2026-06-11T19:30:00Z'

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS old_email_array text[];

COMMENT ON COLUMN helloworldjunktest.singles.old_email_array IS
  'History of replaced email addresses. Each text[] item is email|timestamptz (ISO8601). NULL if never changed.';
