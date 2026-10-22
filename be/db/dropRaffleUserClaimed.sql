-- raffle_user.raffle_claimed is replaced by raffle_status (see addRaffleUserStatus.sql):
--   host-verified winner = raffle_status IS NOT NULL (WINVERIFIED / CLAIMED / PAID).
-- raffle_claimed_datetime stays as the host-verify time.
ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  DROP COLUMN IF EXISTS raffle_claimed;
