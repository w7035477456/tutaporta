-- todo_item.due_date — Due Date calendar icon on each ToDo task (NULL = never set → grey icon).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterTodoItemDueDate.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterTodoItemDueDate.sql

ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD COLUMN IF NOT EXISTS due_date date NULL;

COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.due_date IS
  'Optional due date for the task. Past due (and not in Todo Done) → calendar icon blinks.';
