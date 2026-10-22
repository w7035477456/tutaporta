-- Every "Draw Winning Number" click on /host (one row per draw, in order). raffle_user_id = the ticket holding
-- the drawn number, or NULL when nobody holds it. Read by the payout email to raffle@tutamall.com.
CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_draw (
  raffle_draw_id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.raffle_event (event_id) ON DELETE CASCADE,
  raffle_number integer NOT NULL,
  raffle_user_id bigint DEFAULT NULL,
  raffle_draw_datetime timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffle_draw_event_idx
  ON outdateddbsnapshotoct2024.raffle_draw (event_id, raffle_draw_datetime);
