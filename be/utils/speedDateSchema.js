import pool from '../db/connection.js';

let bootstrapPromise = null;

const DDL = [
  `
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
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_rsvp (
    event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
    singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'joined',
    last_seen_at timestamptz NOT NULL DEFAULT NOW(),
    camera_ready boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, singles_id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_round (
    round_id bigserial PRIMARY KEY,
    event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
    round_no integer NOT NULL,
    status text NOT NULL DEFAULT 'live',
    started_at timestamptz NOT NULL DEFAULT NOW(),
    ends_at timestamptz NOT NULL,
    UNIQUE (event_id, round_no)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_pair (
    pair_id bigserial PRIMARY KEY,
    event_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_event (event_id) ON DELETE CASCADE,
    round_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_round (round_id) ON DELETE CASCADE,
    singles_low bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
    singles_high bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
    low_want_meet boolean,
    high_want_meet boolean,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_speed_date_pair_event_history
     ON helloworldjunktest.speed_date_pair (event_id, singles_low, singles_high)`,
  `CREATE INDEX IF NOT EXISTS idx_speed_date_pair_round
     ON helloworldjunktest.speed_date_pair (round_id)`,
  `
  CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_sitout (
    round_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_round (round_id) ON DELETE CASCADE,
    singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
    PRIMARY KEY (round_id, singles_id)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS helloworldjunktest.speed_date_signal (
    signal_id bigserial PRIMARY KEY,
    pair_id bigint NOT NULL REFERENCES helloworldjunktest.speed_date_pair (pair_id) ON DELETE CASCADE,
    from_singles_id bigint NOT NULL REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
    kind text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_speed_date_signal_pair
     ON helloworldjunktest.speed_date_signal (pair_id, signal_id)`
];

export async function ensureSpeedDateSchema() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    for (const sql of DDL) {
      await pool.query(sql);
    }
  })().catch((err) => {
    bootstrapPromise = null;
    throw err;
  });
  return bootstrapPromise;
}
