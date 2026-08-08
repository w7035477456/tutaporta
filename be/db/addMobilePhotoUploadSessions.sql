-- Short-lived QR mobile photo upload sessions (scan on phone → upload without desktop login).
-- Run against Primary. Safe to re-run.

CREATE TABLE IF NOT EXISTS helloworldjunktest.mobile_photo_upload_sessions (
  token text PRIMARY KEY,
  singles_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  photos_id integer,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS mobile_photo_upload_sessions_expires_idx
  ON helloworldjunktest.mobile_photo_upload_sessions (expires_at);

CREATE INDEX IF NOT EXISTS mobile_photo_upload_sessions_singles_created_idx
  ON helloworldjunktest.mobile_photo_upload_sessions (singles_id, created_at DESC);
