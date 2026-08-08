-- Remove legacy Record Vault Postgres storage (notebooks/notes/keywords/shortcuts).
-- Vault content lives only on encrypted USB (.recordvault/vault.db.enc).
-- Run on Primary:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/dropRecordVaultPostgresVaultData.sql

BEGIN;

DROP TABLE IF EXISTS helloworldjunktest.record_vault_note_keywords CASCADE;
DROP TABLE IF EXISTS helloworldjunktest.record_vault_shortcuts CASCADE;
DROP TABLE IF EXISTS helloworldjunktest.record_vault_notes CASCADE;
DROP TABLE IF EXISTS helloworldjunktest.record_vault_notebooks CASCADE;
DROP TABLE IF EXISTS helloworldjunktest.record_vault_deleted_images CASCADE;

DROP SEQUENCE IF EXISTS helloworldjunktest.record_vault_note_keyword_id_seq;
DROP SEQUENCE IF EXISTS helloworldjunktest.record_vault_shortcut_id_seq;
DROP SEQUENCE IF EXISTS helloworldjunktest.record_vault_note_id_seq;
DROP SEQUENCE IF EXISTS helloworldjunktest.record_vault_notebook_id_seq;

COMMIT;
