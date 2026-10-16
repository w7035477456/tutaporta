-- Host password for /vr (raffle host draw + verify). Only a bcrypt hash is stored.
-- Failed attempts / lock live here (not in process memory) so every server in the cluster agrees.

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.raffle_host
  ADD COLUMN IF NOT EXISTS host_password_hash text,
  ADD COLUMN IF NOT EXISTS host_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_locked_until timestamptz;

COMMENT ON COLUMN outdateddbsnapshotoct2024.raffle_host.host_password_hash IS
  'bcrypt hash of the host password used on /vr. Set with setup_host / set_host_password.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.raffle_host.host_failed_attempts IS
  'Consecutive wrong /vr host passwords; reset on success.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.raffle_host.host_locked_until IS
  'No /vr password attempts accepted before this time.';

COMMIT;
