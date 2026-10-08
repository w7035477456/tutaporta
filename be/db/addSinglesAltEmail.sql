-- outdateddbsnapshotoct2024.singles.alt_email — optional second address.
-- When set, every transactional email addressed to singles.email is also copied here.

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS alt_email VARCHAR(255);

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.alt_email IS
  'Optional alternate/2nd email. NULL = no copy. Outbound mail CCs this address when set.';

-- Lookup path for outbound mail: main email -> alt email.
CREATE INDEX IF NOT EXISTS idx_singles_alt_email_by_email
  ON outdateddbsnapshotoct2024.singles (LOWER(email))
  WHERE alt_email IS NOT NULL;
