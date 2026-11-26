-- SMS reminder "Daily, N days ahead": text every morning from N days before the due date
-- through the due date. last_sent_on stops a second text on the same day.
ALTER TABLE outdateddbsnapshotoct2024.sms_reminder
  ADD COLUMN IF NOT EXISTS daily boolean NOT NULL DEFAULT false;
ALTER TABLE outdateddbsnapshotoct2024.sms_reminder
  ADD COLUMN IF NOT EXISTS last_sent_on date NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.sms_reminder.daily IS
  'true = text every day from days_before through the due date; false = one text days_before.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.sms_reminder.last_sent_on IS
  'Day (SMS_REMINDER_TZ) of the last reminder text; daily reminders send at most once per day.';
