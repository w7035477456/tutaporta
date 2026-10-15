-- Meetup raffle tickets (tutamall.com/mall "Get My Raffle").
--   * One ticket per member per event (UNIQUE event_key + singles_id).
--   * Raffle numbers 1–1000, never repeated within an event (UNIQUE event_key + raffle_number).
--   * verify_code: random 8-char code (no 0/O/1/I/L), drawn separately from the number; the QR
--     links to tutamall.com/raffle/verify/<code> so a faked number cannot be paired with a real code.
--
-- Mac:    psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addRaffleTickets.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/addRaffleTickets.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_tickets (
  raffle_ticket_id bigserial PRIMARY KEY,
  event_key text NOT NULL,
  singles_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  raffle_number integer NOT NULL CHECK (raffle_number BETWEEN 1 AND 1000),
  verify_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raffle_tickets_event_singles_uniq UNIQUE (event_key, singles_id),
  CONSTRAINT raffle_tickets_event_number_uniq UNIQUE (event_key, raffle_number),
  CONSTRAINT raffle_tickets_verify_code_uniq UNIQUE (verify_code)
);

CREATE INDEX IF NOT EXISTS raffle_tickets_singles_id_idx
  ON outdateddbsnapshotoct2024.raffle_tickets (singles_id);

COMMENT ON TABLE outdateddbsnapshotoct2024.raffle_tickets IS
  'Meetup raffle tickets: one per member per event; number 1-1000 unique per event; verify_code backs the QR check.';
