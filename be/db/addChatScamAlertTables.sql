-- AI scam detection for 1:1 Buddies / Acquaint chat (chat_log).
-- Every new message triggers a scan of the last 50 messages of that conversation with the
-- local Ollama model (OLLAMA_MODEL). A positive verdict with new evidence adds a chat_scam_alert
-- row; the victim alone sees the red warning in the chat, and
-- Admin Tools → Scam Alert lists the row with the scammer profile and the conversation.

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.chat_scam_alert (
  scam_alert_id bigserial PRIMARY KEY,
  conv_id text NOT NULL,
  scammer_singles_id bigint NOT NULL,
  victim_singles_id bigint NOT NULL,
  trigger_msg_id bigint NOT NULL,
  risk_score smallint NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  scam_category text NOT NULL DEFAULT 'other',
  reason text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversation jsonb NOT NULL DEFAULT '[]'::jsonb,
  llm_model text NOT NULL DEFAULT '',
  detection_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed')),
  admin_note text NOT NULL DEFAULT '',
  victim_first_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Each new scam episode gets its own row (see protectChatScamAlert.sql: rows are never deleted).
CREATE INDEX IF NOT EXISTS chat_scam_alert_pair_idx
  ON outdateddbsnapshotoct2024.chat_scam_alert (conv_id, scammer_singles_id, victim_singles_id, scam_alert_id DESC);

CREATE INDEX IF NOT EXISTS chat_scam_alert_victim_idx
  ON outdateddbsnapshotoct2024.chat_scam_alert (victim_singles_id, scammer_singles_id)
  WHERE status IN ('open', 'confirmed');

CREATE INDEX IF NOT EXISTS chat_scam_alert_created_idx
  ON outdateddbsnapshotoct2024.chat_scam_alert (created_at DESC);

-- Last scan per conversation: skips re-scanning the same newest message on another web server
-- and keeps the latest verdict (including "not a scam") for troubleshooting.
CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.chat_scam_scan (
  conv_id text PRIMARY KEY,
  last_scanned_msg_id bigint NOT NULL DEFAULT 0,
  last_scanned_at timestamptz,
  last_is_scam boolean NOT NULL DEFAULT false,
  last_risk_score smallint NOT NULL DEFAULT 0,
  last_verdict jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text NOT NULL DEFAULT '',
  scan_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
