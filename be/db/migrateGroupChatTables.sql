-- Group Chat tables (helloworldjunktest)
-- Mirrors 1:1 chat pattern: small room/member/invite/read tables + partitioned group_chat_log.
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/migrateGroupChatTables.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Room
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat (
  group_id    bigserial PRIMARY KEY,
  created_by  bigint NOT NULL,
  title       text NULL,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_chat_created_by
  ON helloworldjunktest.group_chat (created_by);

-- One active host-group per user (v1: one group chat room owned by each host).
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_chat_one_active_per_host
  ON helloworldjunktest.group_chat (created_by)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 2) Members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_member (
  group_id    bigint NOT NULL REFERENCES helloworldjunktest.group_chat (group_id),
  singles_id  bigint NOT NULL,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('host', 'member')),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'left', 'removed')),
  joined_at   timestamptz NOT NULL DEFAULT NOW(),
  left_at     timestamptz NULL,
  PRIMARY KEY (group_id, singles_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_member_singles_id
  ON helloworldjunktest.group_chat_member (singles_id);

CREATE INDEX IF NOT EXISTS idx_group_chat_member_active
  ON helloworldjunktest.group_chat_member (singles_id, group_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3) Invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_invite (
  invite_id     bigserial PRIMARY KEY,
  group_id      bigint NOT NULL REFERENCES helloworldjunktest.group_chat (group_id),
  inviter_id    bigint NOT NULL,
  invitee_id    bigint NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  responded_at  timestamptz NULL,
  CHECK (inviter_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_invite_invitee_pending
  ON helloworldjunktest.group_chat_invite (invitee_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_group_chat_invite_group_id
  ON helloworldjunktest.group_chat_invite (group_id, created_at DESC);

-- At most one pending invite per (group, invitee).
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_chat_invite_pending
  ON helloworldjunktest.group_chat_invite (group_id, invitee_id)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 4) Messages — quarterly RANGE partitions (same pattern as chat_log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_log (
  msg_id      bigserial,
  group_id    bigint NOT NULL,
  sender_id   bigint NOT NULL,
  msg_text    text NOT NULL,
  msg_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (created_at, msg_id)
) PARTITION BY RANGE (created_at);

-- Current UTC quarter (2026 Q3: Jul–Sep) + next (2026 Q4: Oct–Dec).
-- Bounds use UTC calendar quarters (matches be/utils/quarterlyRangePartitions.js).
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_log_2026_quarter3
  PARTITION OF helloworldjunktest.group_chat_log
  FOR VALUES FROM (
    (DATE '2026-07-01' + TIME '00:00:00') AT TIME ZONE 'UTC'
  ) TO (
    (DATE '2026-10-01' + TIME '00:00:00') AT TIME ZONE 'UTC'
  );

CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_log_2026_quarter4
  PARTITION OF helloworldjunktest.group_chat_log
  FOR VALUES FROM (
    (DATE '2026-10-01' + TIME '00:00:00') AT TIME ZONE 'UTC'
  ) TO (
    (DATE '2027-01-01' + TIME '00:00:00') AT TIME ZONE 'UTC'
  );

CREATE INDEX IF NOT EXISTS idx_group_chat_log_perf
  ON helloworldjunktest.group_chat_log (group_id, created_at DESC, msg_id DESC);

CREATE INDEX IF NOT EXISTS idx_group_chat_log_sender
  ON helloworldjunktest.group_chat_log (sender_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Read state (unread)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS helloworldjunktest.group_chat_read_state (
  singles_id    bigint NOT NULL,
  group_id      bigint NOT NULL REFERENCES helloworldjunktest.group_chat (group_id),
  last_read_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (singles_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_read_state_group_id
  ON helloworldjunktest.group_chat_read_state (group_id);

COMMIT;

-- Verify:
--   \dt helloworldjunktest.group_chat*
--   \d+ helloworldjunktest.group_chat_log
