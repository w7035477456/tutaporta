-- chat_scam_alert is a permanent record:
--   * every new scam episode in a conversation is its own row (no more one-live-row-per-pair), and
--   * rows can never be deleted: DELETE, TRUNCATE and DROP TABLE are all refused.
-- Status / admin_note / victim_first_seen_at updates are still allowed.

DROP INDEX IF EXISTS outdateddbsnapshotoct2024.chat_scam_alert_live_pair_uq;

CREATE INDEX IF NOT EXISTS chat_scam_alert_pair_idx
  ON outdateddbsnapshotoct2024.chat_scam_alert (conv_id, scammer_singles_id, victim_singles_id, scam_alert_id DESC);

CREATE OR REPLACE FUNCTION outdateddbsnapshotoct2024.prevent_chat_scam_alert_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'outdateddbsnapshotoct2024.chat_scam_alert is permanent: % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_chat_scam_alert_delete ON outdateddbsnapshotoct2024.chat_scam_alert;
CREATE TRIGGER trg_prevent_chat_scam_alert_delete
  BEFORE DELETE ON outdateddbsnapshotoct2024.chat_scam_alert
  FOR EACH ROW
  EXECUTE FUNCTION outdateddbsnapshotoct2024.prevent_chat_scam_alert_delete();

DROP TRIGGER IF EXISTS trg_prevent_chat_scam_alert_truncate ON outdateddbsnapshotoct2024.chat_scam_alert;
CREATE TRIGGER trg_prevent_chat_scam_alert_truncate
  BEFORE TRUNCATE ON outdateddbsnapshotoct2024.chat_scam_alert
  FOR EACH STATEMENT
  EXECUTE FUNCTION outdateddbsnapshotoct2024.prevent_chat_scam_alert_delete();

-- DROP TABLE / DROP SCHEMA … CASCADE: the event trigger aborts the whole transaction.
CREATE OR REPLACE FUNCTION outdateddbsnapshotoct2024.prevent_chat_scam_alert_drop()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_event_trigger_dropped_objects() d
     WHERE d.object_type = 'table'
       AND d.schema_name = 'outdateddbsnapshotoct2024'
       AND d.object_name = 'chat_scam_alert'
  ) THEN
    RAISE EXCEPTION 'outdateddbsnapshotoct2024.chat_scam_alert is permanent: DROP is not allowed';
  END IF;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_prevent_chat_scam_alert_drop;
CREATE EVENT TRIGGER trg_prevent_chat_scam_alert_drop
  ON sql_drop
  EXECUTE FUNCTION outdateddbsnapshotoct2024.prevent_chat_scam_alert_drop();
