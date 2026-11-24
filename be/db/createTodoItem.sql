-- todo_item — TutaNotes Bill Schedule → ToDo board (3 swim lanes).
-- lane: 'repo' (Todo Repository) | 'scheduled' (Todo Scheduled) | 'done' (Todo Done)
-- seq: 1-based order within (singles_id, storage_backend, lane); shown as the task number.
-- Saved by full replace (PUT /api/todoItems), so seq is always contiguous.
-- Then run be/db/alterPaidRecordTodo.sql (adds paid_record_id for the paperclip / Bills-Receipts popup).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/createTodoItem.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/createTodoItem.sql

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.todo_item (
  todo_item_id bigserial PRIMARY KEY,
  singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  storage_backend text NOT NULL DEFAULT 'tutaCloud'
    CHECK (storage_backend IN ('tutaCloud', 'usb')),
  lane text NOT NULL
    CHECK (lane IN ('repo', 'scheduled', 'done')),
  seq integer NOT NULL
    CHECK (seq >= 1),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT todo_item_singles_storage_lane_seq_uniq
    UNIQUE (singles_id, storage_backend, lane, seq)
);

CREATE INDEX IF NOT EXISTS todo_item_singles_storage_idx
  ON outdateddbsnapshotoct2024.todo_item (singles_id, storage_backend);

COMMENT ON TABLE outdateddbsnapshotoct2024.todo_item IS
  'TutaNotes ToDo board tasks: lane repo/scheduled/done, seq = order within lane.';
