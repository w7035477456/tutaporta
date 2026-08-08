-- helloworldjunktest.singles — prior phone numbers with change timestamps (Primary only).
-- Nullable text[]: NULL = no history yet.
-- Each element encodes phone + change time in one string:
--   "<phone>|<changed_at ISO8601>"
-- Example: '+14155551234|2026-06-11T19:30:00Z'

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS old_phone_array text[];

COMMENT ON COLUMN helloworldjunktest.singles.old_phone_array IS
  'History of replaced phone numbers. Each text[] item is phone|timestamptz (ISO8601). NULL if never changed.';
