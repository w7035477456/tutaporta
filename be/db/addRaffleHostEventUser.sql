-- Meetup raffle: raffle_host → raffle_event → raffle_user (replaces interim raffle_tickets).
--   raffle_host  : who runs the event.
--   raffle_event : Get My Raffle drop-down rows (event_show_combo = true only) + raffle window.
--   raffle_user  : one row per member per event (created when the member picks the event);
--                  raffle_number stays NULL until Generate My Raffle.
--
-- Mac:    psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -v ON_ERROR_STOP=1 -f be/db/addRaffleHostEventUser.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/addRaffleHostEventUser.sql

BEGIN;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_host (
  raffle_host_id bigserial PRIMARY KEY,
  host_full_name text NOT NULL,
  host_email text NULL,
  host_phone text NULL,
  host_url text NULL
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_event (
  event_id bigserial PRIMARY KEY,
  event_show_combo boolean NOT NULL DEFAULT false,
  raffle_host_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.raffle_host (raffle_host_id),
  event_title text NOT NULL,
  event_url text NULL,
  event_night_datetime timestamptz NULL,
  event_build_n_address text NULL,
  host_event_raffle_start timestamptz NULL,
  host_event_raffle_end timestamptz NULL
);

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_user (
  raffle_user_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  raffle_host_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.raffle_host (raffle_host_id),
  event_id bigint NOT NULL REFERENCES outdateddbsnapshotoct2024.raffle_event (event_id),
  raffle_number integer NULL CHECK (raffle_number BETWEEN 1 AND 1000),
  raffle_generated_id text NULL,
  raffle_generate_datetime timestamptz NULL,
  CONSTRAINT raffle_user_singles_event_uniq UNIQUE (singles_id, event_id),
  CONSTRAINT raffle_user_event_number_uniq UNIQUE (event_id, raffle_number),
  CONSTRAINT raffle_user_generated_id_uniq UNIQUE (raffle_generated_id)
);

CREATE INDEX IF NOT EXISTS raffle_user_singles_id_idx ON outdateddbsnapshotoct2024.raffle_user (singles_id);

COMMENT ON TABLE outdateddbsnapshotoct2024.raffle_host IS 'Meetup raffle hosts.';
COMMENT ON TABLE outdateddbsnapshotoct2024.raffle_event IS
  'Meetup raffle events; event_show_combo=true rows appear in Get My Raffle; tickets only between host_event_raffle_start and host_event_raffle_end.';
COMMENT ON TABLE outdateddbsnapshotoct2024.raffle_user IS
  'One row per member per raffle event; raffle_number (1-1000, unique per event) set once by Generate My Raffle; raffle_generated_id = QR verification code.';

-- Seed hosts + the two current events (idempotent).
INSERT INTO outdateddbsnapshotoct2024.raffle_host (host_full_name, host_url)
SELECT 'Sam M.', 'https://www.meetup.com/social-sips-bites-mclean-edition/'
WHERE NOT EXISTS (SELECT 1 FROM outdateddbsnapshotoct2024.raffle_host WHERE host_full_name = 'Sam M.');

INSERT INTO outdateddbsnapshotoct2024.raffle_host (host_full_name, host_url)
SELECT 'Mustafa R.', 'https://www.meetup.com/dmv-social-20-s-40-s/'
WHERE NOT EXISTS (SELECT 1 FROM outdateddbsnapshotoct2024.raffle_host WHERE host_full_name = 'Mustafa R.');

INSERT INTO outdateddbsnapshotoct2024.raffle_event (
  event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime, event_build_n_address,
  host_event_raffle_start, host_event_raffle_end
)
SELECT true, h.raffle_host_id,
  'Social Sips & Bites Halloween Party at The Greenhouse!',
  'https://www.meetup.com/social-sips-bites-mclean-edition/events/316355608/?recId=df3aa9bc-4b09-428c-bb1e-5724f22c7ba3&recSource=ml-popular-events-nearby-offline&searchId=74883366-2f70-4c05-ab1c-787e0f3c4a50&eventOrigin=find_page%24inPerson',
  TIMESTAMPTZ '2026-10-29 18:00:00 America/New_York',
  'Greenhouse Bistro, 2070 Chain Bridge Road, Vienna, VA',
  TIMESTAMPTZ '2026-10-15 00:00:00 America/New_York',
  TIMESTAMPTZ '2026-10-29 23:00:00 America/New_York'
FROM outdateddbsnapshotoct2024.raffle_host h
WHERE h.host_full_name = 'Sam M.'
  AND NOT EXISTS (
    SELECT 1 FROM outdateddbsnapshotoct2024.raffle_event
     WHERE event_title = 'Social Sips & Bites Halloween Party at The Greenhouse!'
  );

INSERT INTO outdateddbsnapshotoct2024.raffle_event (
  event_show_combo, raffle_host_id, event_title, event_url, event_night_datetime, event_build_n_address,
  host_event_raffle_start, host_event_raffle_end
)
SELECT true, h.raffle_host_id,
  'Meet & Greet',
  'https://www.meetup.com/dmv-social-20-s-40-s/events/316715239/?recId=df3aa9bc-4b09-428c-bb1e-5724f22c7ba3&recSource=ml-popular-events-nearby-offline&searchId=74883366-2f70-4c05-ab1c-787e0f3c4a50&eventOrigin=find_page%24inPerson',
  NULL,
  'Punchbowl Social - Arlington, 4238 Wilson Blvd Ste 1160, Arlington, VA',
  TIMESTAMPTZ '2026-10-15 00:00:00 America/New_York',
  TIMESTAMPTZ '2026-10-31 23:59:00 America/New_York'
FROM outdateddbsnapshotoct2024.raffle_host h
WHERE h.host_full_name = 'Mustafa R.'
  AND NOT EXISTS (SELECT 1 FROM outdateddbsnapshotoct2024.raffle_event WHERE event_title = 'Meet & Greet');

-- Carry tickets from the interim raffle_tickets table, then drop it.
DO $$
BEGIN
  IF to_regclass('outdateddbsnapshotoct2024.raffle_tickets') IS NOT NULL THEN
    INSERT INTO outdateddbsnapshotoct2024.raffle_user (
      singles_id, raffle_host_id, event_id, raffle_number, raffle_generated_id, raffle_generate_datetime
    )
    SELECT t.singles_id, e.raffle_host_id, e.event_id, t.raffle_number, t.verify_code, t.created_at
      FROM outdateddbsnapshotoct2024.raffle_tickets t
      JOIN outdateddbsnapshotoct2024.raffle_event e
        ON e.event_title = CASE t.event_key
             WHEN 'ssb-halloween-greenhouse-2026' THEN 'Social Sips & Bites Halloween Party at The Greenhouse!'
             WHEN 'meet-greet-mustafa-2026' THEN 'Meet & Greet'
           END
    ON CONFLICT DO NOTHING;
    DROP TABLE outdateddbsnapshotoct2024.raffle_tickets;
  END IF;
END $$;

COMMIT;
