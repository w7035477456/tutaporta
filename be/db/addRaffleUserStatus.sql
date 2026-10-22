-- raffle_user.raffle_status — winner lifecycle:
--   WINVERIFIED  host scanned / typed the winning ticket
--   CLAIMED      winner submitted PayPal / Venmo info
--   PAID         admin clicked "Mark Paid" in Admin Tools → Raffles (raffle_prize_paid = true)
-- NULL = ordinary ticket (not a verified winner).
ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  ADD COLUMN IF NOT EXISTS raffle_status text;

-- One-time backfill from the old raffle_claimed boolean (skipped once dropRaffleUserClaimed.sql has run).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'outdateddbsnapshotoct2024' AND table_name = 'raffle_user' AND column_name = 'raffle_claimed'
  ) THEN
    UPDATE outdateddbsnapshotoct2024.raffle_user
       SET raffle_status = CASE
             WHEN raffle_prize_paid THEN 'PAID'
             WHEN raffle_claimed AND (paypal_info IS NOT NULL OR venmo_info IS NOT NULL) THEN 'CLAIMED'
             WHEN raffle_claimed THEN 'WINVERIFIED'
           END
     WHERE raffle_status IS NULL
       AND (raffle_claimed OR raffle_prize_paid);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'raffle_user_raffle_status_check'
       AND conrelid = 'outdateddbsnapshotoct2024.raffle_user'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.raffle_user
      ADD CONSTRAINT raffle_user_raffle_status_check
      CHECK (raffle_status IN ('WINVERIFIED', 'CLAIMED', 'PAID'));
  END IF;
END
$$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.raffle_user.raffle_status IS
  'Winner lifecycle: WINVERIFIED (host verified) → CLAIMED (PayPal/Venmo submitted) → PAID (admin Mark Paid). NULL = not a verified winner.';
