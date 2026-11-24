-- todo_item.kind — 'task' (a normal ToDo card) or 'divider' (a dashed line the user drags into a lane
-- to split its tasks into groups). Dividers keep body '' and no paperclip / due date / done time.
-- Existing rows become 'task'.
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterTodoItemKind.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterTodoItemKind.sql

ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'task';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'todo_item_kind_check'
       AND conrelid = 'outdateddbsnapshotoct2024.todo_item'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.todo_item
      ADD CONSTRAINT todo_item_kind_check CHECK (kind IN ('task', 'divider'));
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.kind IS
  'task = ToDo card; divider = dashed separator line inside a lane (body empty).';
