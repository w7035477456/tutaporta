-- Bonus raffle tickets bought with singles.raffle_refer_credit: extra raffle_user rows (raffle_bonus = true)
-- per member per event. Only the member's own (non-bonus) ticket stays unique per (singles_id, event_id).
ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  ADD COLUMN IF NOT EXISTS raffle_bonus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raffle_bonus_batch_count integer,
  ADD COLUMN IF NOT EXISTS raffle_bonus_credits_used integer;

ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  DROP CONSTRAINT IF EXISTS raffle_user_singles_event_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS raffle_user_singles_event_main_uniq
  ON outdateddbsnapshotoct2024.raffle_user (singles_id, event_id)
  WHERE NOT raffle_bonus;
