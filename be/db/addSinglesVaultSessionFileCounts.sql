-- Session file tx/rx counts for TutaNotes USB / browser transfers.
-- Resets to 0 on vault unlock (next session). Cluster-safe via Postgres Primary.
-- Run on Primary (Mac example — use DB_* from ~/.ssh/be/.env):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addSinglesVaultSessionFileCounts.sql

BEGIN;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_session_usb_tx_rx_count integer NOT NULL DEFAULT 0;

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS notes_session_ui_tx_rx_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN helloworldjunktest.singles.notes_session_usb_tx_rx_count IS
  'Running COUNT of notebooks/notes/files transferred between USB and the website app this vault session. Resets on unlock.';

COMMENT ON COLUMN helloworldjunktest.singles.notes_session_ui_tx_rx_count IS
  'Running COUNT of notebooks/notes/files transferred between backend (or USB bridge) and the user browser this vault session. Resets on unlock.';

COMMIT;
