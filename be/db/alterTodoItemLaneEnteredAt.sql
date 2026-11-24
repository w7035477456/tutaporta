-- todo_item.lane_entered_at — when the task landed in its current swim lane.
-- The task's day counter = calendar days since this (0 on the day it lands; resets on a lane change).
-- Existing rows start at now() (0 days).
--
-- Run (Mac):
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/alterTodoItemLaneEnteredAt.sql
-- Ubuntu Primary (from Mac):
--   scripts/ubuntu-psql.sh -f be/db/alterTodoItemLaneEnteredAt.sql

ALTER TABLE outdateddbsnapshotoct2024.todo_item
  ADD COLUMN IF NOT EXISTS lane_entered_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN outdateddbsnapshotoct2024.todo_item.lane_entered_at IS
  'When the task entered its current lane; drives the "days in this lane" counter. Reset on lane change.';
