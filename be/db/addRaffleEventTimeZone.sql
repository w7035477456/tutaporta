-- raffle_event.event_time_zone: the zone the host typed the event / raffle times in (IANA name).
-- The timestamptz columns still store the exact moment; this column says how to display it.
-- raffle_event_local shows every time in the event's own zone (for DBeaver / psql).

BEGIN;

ALTER TABLE outdateddbsnapshotoct2024.raffle_event
  ADD COLUMN IF NOT EXISTS event_time_zone text NOT NULL DEFAULT 'America/New_York';

COMMENT ON COLUMN outdateddbsnapshotoct2024.raffle_event.event_time_zone IS
  'IANA time zone of the event (America/New_York, America/Los_Angeles, …); times below are shown in this zone.';

UPDATE outdateddbsnapshotoct2024.raffle_event
   SET event_time_zone = 'America/Los_Angeles'
 WHERE event_build_n_address LIKE '%, CA %'
   AND event_time_zone = 'America/New_York';

CREATE OR REPLACE VIEW outdateddbsnapshotoct2024.raffle_event_local AS
SELECT e.event_id,
       e.event_show_combo,
       e.raffle_host_id,
       e.event_title,
       e.event_time_zone,
       e.event_night_datetime    AT TIME ZONE e.event_time_zone AS event_night_local,
       e.host_event_raffle_start AT TIME ZONE e.event_time_zone AS raffle_start_local,
       e.host_event_raffle_end   AT TIME ZONE e.event_time_zone AS raffle_end_local,
       e.event_build_n_address,
       e.event_url
  FROM outdateddbsnapshotoct2024.raffle_event e;

COMMIT;
