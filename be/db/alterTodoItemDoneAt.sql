-- todo_item.done_at — when the task was moved into Todo Done (editable from the DONE badge).
-- NULL outside the Done lane (moving a task out of Done clears it).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterTodoItemDoneAt.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterTodoItemDoneAt.sql

ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD COLUMN IF NOT EXISTS done_at timestamptz NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.done_at IS
  'Date/time the task was completed (moved to Todo Done); user-editable. NULL when not in Done.';
