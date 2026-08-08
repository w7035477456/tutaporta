-- Last vault-session Usb/ui tx/rx snapshot (shown on Cloud/USB login after logoff).
-- Run on Primary (Mac — use DB_* from ~/.ssh/be/.env):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesVaultLastSessionFileCounts.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_last_session_usb_tx_rx_count integer NOT NULL DEFAULT 0;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_last_session_ui_tx_rx_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN helloworldjunktest.singles.notes_last_session_usb_tx_rx_count IS
  'Usb tx/rx count from the most recent vault logoff — shown on login gate until next session.';

COMMENT ON COLUMN helloworldjunktest.singles.notes_last_session_ui_tx_rx_count IS
  'ui tx/rx count from the most recent vault logoff — shown on login gate until next session.';

COMMIT;
