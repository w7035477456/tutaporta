-- Locked Subscription (TutaNotes Bill Schedule → Subscription → "Locked Subscription" button).
--  * subscription_bill.locked = true rows form a second, password-protected Subscription table.
--    Locked and normal rows each number their own # from 1, so the unique key gains `locked`.
--  * subscription_lock holds one Argon2id password hash per member (set on first unlock)
--    plus a simple failed-attempt lockout. The API only returns/saves locked rows with a
--    short-lived unlock token issued after the password checks out.

ALTER TABLE outdateddbsnapshotoct2024.subscription_bill
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

ALTER TABLE outdateddbsnapshotoct2024.subscription_bill
  DROP CONSTRAINT IF EXISTS subscription_bill_singles_storage_ym_row_uniq;
ALTER TABLE outdateddbsnapshotoct2024.subscription_bill
  ADD CONSTRAINT subscription_bill_singles_storage_ym_row_uniq
  UNIQUE (singles_id, storage_backend, bill_year, bill_month, locked, row_index);

COMMENT ON COLUMN outdateddbsnapshotoct2024.subscription_bill.locked IS
  'true = row lives in the password-protected Locked Subscription table.';

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.subscription_lock (
  singles_id bigint PRIMARY KEY
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outdateddbsnapshotoct2024.subscription_lock IS
  'Locked Subscription password (Argon2id hash) per member; failed_attempts/locked_until throttle guessing.';
