-- TutaNotes join / list indexes for outdateddbsnapshotoct2024.notes_* (+ vault_cluster_state).
-- Complements PKs and the three partial indexes in addNotesVaultDataTables.sql.
--
-- Hot paths (be/utils/recordVaultUsb/vaultSession.js):
--   notebooks list: WHERE singles_id AND deleted_at IS NULL ORDER BY display_order, notebook_id
--   shortcuts tree: WHERE singles_id ORDER BY display_order; JOIN notebooks/notes on (singles_id, notebook_id|note_id)
--   delete notebook / note: DELETE shortcuts WHERE singles_id AND (notebook_id|note_id)
--   hard-delete media by note_id (includes soft-deleted rows): attachments / extra_images
--
-- Run on Primary (Mac and Ubuntu):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addNotesVaultJoinIndexes.sql
--   scripts/ubuntu-psql.sh -f be/db/addNotesVaultJoinIndexes.sql

BEGIN;

-- notebooks: active tree / reorder listing
CREATE INDEX IF NOT EXISTS idx_notes_notebooks_active
  ON outdateddbsnapshotoct2024.notes_notebooks (singles_id, display_order, notebook_id)
  WHERE deleted_at IS NULL;

-- notes: member-wide active listing (tree load orders by display_order, not notebook_id)
CREATE INDEX IF NOT EXISTS idx_notes_notes_member_active
  ON outdateddbsnapshotoct2024.notes_notes (singles_id, display_order, note_id)
  WHERE deleted_at IS NULL;

-- shortcuts: list + join/delete by notebook or note
CREATE INDEX IF NOT EXISTS idx_notes_shortcuts_member_order
  ON outdateddbsnapshotoct2024.notes_shortcuts (singles_id, display_order, shortcut_id);

CREATE INDEX IF NOT EXISTS idx_notes_shortcuts_notebook
  ON outdateddbsnapshotoct2024.notes_shortcuts (singles_id, notebook_id);

CREATE INDEX IF NOT EXISTS idx_notes_shortcuts_note
  ON outdateddbsnapshotoct2024.notes_shortcuts (singles_id, note_id)
  WHERE note_id IS NOT NULL;

-- keywords: member-wide keyword load for search (ORDER BY keyword_normalized)
CREATE INDEX IF NOT EXISTS idx_notes_note_keywords_member_normalized
  ON outdateddbsnapshotoct2024.notes_note_keywords (singles_id, keyword_normalized, note_id);

-- attachments / extra images: hard-delete and any join that includes soft-deleted rows
-- (partial *_note_active indexes only cover deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_notes_note_attachments_note
  ON outdateddbsnapshotoct2024.notes_note_attachments (singles_id, note_id);

CREATE INDEX IF NOT EXISTS idx_notes_note_extra_images_note
  ON outdateddbsnapshotoct2024.notes_note_extra_images (singles_id, note_id);

-- vault_cluster_state: EXISTS / lookup by singles_id alone (PK leads with product)
CREATE INDEX IF NOT EXISTS idx_vault_cluster_state_singles_id
  ON outdateddbsnapshotoct2024.vault_cluster_state (singles_id);

COMMIT;
