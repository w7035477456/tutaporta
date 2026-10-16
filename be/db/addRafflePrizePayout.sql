-- Raffle prize payout: winner picks PayPal or Venmo on /mall after the host verified (claimed) the ticket;
-- admin marks the prize paid. raffle_claimed_datetime = when the host scan / code verified the ticket.
ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  ADD COLUMN IF NOT EXISTS venmo_info text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paypal_info text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS raffle_prize_paid boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS raffle_prize_paid_datetime timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS raffle_claimed_datetime timestamptz DEFAULT NULL;
