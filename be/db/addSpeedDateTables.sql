-- helloworldjunktest.speed_date_* — in-site 1:1 speed dating (WebRTC signaling in Postgres).
-- Video media is peer-to-peer between browsers; app servers only store match/signaling rows.
-- Run: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSpeedDateTables.sql

BEGIN;

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_event (
  event_id bigserial PRIMARY KEY,
  host_singles_id bigint REFERENCES helloworldjunktest.singles (singles_id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  mix_mode text NOT NULL DEFAULT 'gender',
  round_minutes integer NOT NULL DEFAULT 20,
  intermission_seconds integer NOT NULL DEFAULT 60,
  max_participants integer NOT NULL DEFAULT 50,
  max_rounds integer NOT NULL DEFAULT 6,
  current_round_no integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  zoom_lobby_url text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT speed_date_event_status_check
    CHECK (status IN ('draft', 'open', 'live', 'ended', 'canceled')),
  CONSTRAINT speed_date_event_mix_mode_check
    CHECK (mix_mode IN ('gender', 'random')),
  CONSTRAINT speed_date_event_round_minutes_check
    CHECK (round_minutes BETWEEN 1 AND 60),
  CONSTRAINT speed_date_event_intermission_check
    CHECK (intermission_seconds BETWEEN 0 AND 600),
  CONSTRAINT speed_date_event_max_participants_check
    CHECK (max_participants BETWEEN 2 AND 80),
  CONSTRAINT speed_date_event_max_rounds_check
    CHECK (max_rounds BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS idx_speed_date_event_status
  ON helloworldjunktest.speed_date_event (status, starts_at);

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_rsvp (
  event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
  singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined',
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  camera_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, singles_id),
  CONSTRAINT speed_date_rsvp_status_check CHECK (status IN ('joined', 'left'))
);

CREATE INDEX IF NOT EXISTS idx_speed_date_rsvp_joined
  ON helloworldjunktest.speed_date_rsvp (event_id)
  WHERE status = 'joined';

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_round (
  round_id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
  round_no integer NOT NULL,
  status text NOT NULL DEFAULT 'live',
  started_at timestamptz NOT NULL DEFAULT NOW(),
  ends_at timestamptz NOT NULL,
  UNIQUE (event_id, round_no),
  CONSTRAINT speed_date_round_status_check
    CHECK (status IN ('live', 'intermission', 'ended'))
);

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_pair (
  pair_id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
  round_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_round (round_id) ON DELETE CASCADE,
  singles_low bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  singles_high bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  low_want_meet boolean,
  high_want_meet boolean,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT speed_date_pair_order_check CHECK (singles_low < singles_high),
  CONSTRAINT speed_date_pair_distinct_check CHECK (singles_low <> singles_high)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_speed_date_pair_event_history
  ON helloworldjunktest.speed_date_pair (event_id, singles_low, singles_high);

CREATE INDEX IF NOT EXISTS idx_speed_date_pair_round
  ON helloworldjunktest.speed_date_pair (round_id);

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_sitout (
  round_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_round (round_id) ON DELETE CASCADE,
  singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, singles_id)
);

CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_signal (
  signal_id bigserial PRIMARY KEY,
  pair_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_pair (pair_id) ON DELETE CASCADE,
  from_singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT speed_date_signal_kind_check CHECK (kind IN ('offer', 'answer', 'ice'))
);

CREATE INDEX IF NOT EXISTS idx_speed_date_signal_pair
  ON helloworldjunktest.speed_date_signal (pair_id, signal_id);

COMMIT;
