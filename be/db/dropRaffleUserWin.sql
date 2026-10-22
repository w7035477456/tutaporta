-- raffle_user.raffle_win is replaced by raffle_draw: an event's current winning number is its newest
-- raffle_draw row (latestDrawNumberSql in be/routes/raffle/raffleRoutes.js).
ALTER TABLE outdateddbsnapshotoct2024.raffle_user
  DROP COLUMN IF EXISTS raffle_win;
