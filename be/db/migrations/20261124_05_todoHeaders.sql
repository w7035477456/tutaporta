-- ToDo board: fixed priority headers High / Medium / Low (todo_item.kind = 'header', body = label).
-- Movable like dividers but never deletable; the API re-creates any that are missing.
ALTER TABLE outdateddbsnapshotoct2024.todo_item DROP CONSTRAINT IF EXISTS todo_item_kind_check;
ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD CONSTRAINT todo_item_kind_check CHECK (kind IN ('task', 'divider', 'header'));

COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.kind IS
  'task = ToDo card; divider = dashed separator (body empty); header = fixed High/Medium/Low label (body = label).';
