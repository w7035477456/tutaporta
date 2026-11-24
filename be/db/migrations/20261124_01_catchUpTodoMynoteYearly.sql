-- Catch-up: schema changes made on Mac before the migration runner existed
-- (isdbsame "difference" on 2026-11-24). Every included file is idempotent, so this is a
-- no-op where they already ran (Mac) and brings Ubuntu up to date.
-- \ir paths are relative to this file.

\ir ../createTodoItem.sql
\ir ../alterPaidRecordTodo.sql
\ir ../alterTodoItemDueDate.sql
\ir ../alterTodoItemDoneAt.sql
\ir ../alterTodoItemLaneEnteredAt.sql
\ir ../alterTodoItemKind.sql
\ir ../createMynoteUiPref.sql
\ir ../alterYearlyBillPeriodYearly.sql
