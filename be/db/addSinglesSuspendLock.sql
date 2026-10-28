-- Admin Tools → Scam Alert "Suspend" override.
-- While a singles_id has a row here, singles.status is pinned to 'suspend' no matter which
-- code path (Lookup, signup, ID scan, profile photo activation, …) tries to change it.
-- Removing the row (Scam Alert tab, Suspend off) restores prev_status.

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.singles_suspend_lock (
  singles_id bigint PRIMARY KEY
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  prev_status outdateddbsnapshotoct2024.singles_status,
  scam_alert_id bigint
    REFERENCES outdateddbsnapshotoct2024.chat_scam_alert (scam_alert_id) ON DELETE SET NULL,
  locked_by_singles_id bigint,
  locked_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION outdateddbsnapshotoct2024.enforce_singles_suspend_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM outdateddbsnapshotoct2024.singles_suspend_lock l WHERE l.singles_id = NEW.singles_id
  ) THEN
    NEW.status := 'suspend'::outdateddbsnapshotoct2024.singles_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_singles_suspend_lock ON outdateddbsnapshotoct2024.singles;
CREATE TRIGGER trg_enforce_singles_suspend_lock
  BEFORE UPDATE OF status ON outdateddbsnapshotoct2024.singles
  FOR EACH ROW
  EXECUTE FUNCTION outdateddbsnapshotoct2024.enforce_singles_suspend_lock();
