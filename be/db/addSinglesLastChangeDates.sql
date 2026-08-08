-- helloworldjunktest.singles — last change dates for password, email, phone (Primary only).
-- Nullable date: NULL until the member completes that change at least once.

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS last_password_change_date date,
  ADD COLUMN IF NOT EXISTS last_email_change_date date,
  ADD COLUMN IF NOT EXISTS last_phone_change_date date;

COMMENT ON COLUMN helloworldjunktest.singles.last_password_change_date IS
  'Calendar date of the most recent successful password change. NULL if never changed.';

COMMENT ON COLUMN helloworldjunktest.singles.last_email_change_date IS
  'Calendar date of the most recent successful email change. NULL if never changed.';

COMMENT ON COLUMN helloworldjunktest.singles.last_phone_change_date IS
  'Calendar date of the most recent successful phone change. NULL if never changed.';
