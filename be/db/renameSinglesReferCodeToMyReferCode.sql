-- outdateddbsnapshotoct2024.singles — rename refer_code -> my_refer_code (Primary only)

ALTER TABLE outdateddbsnapshotoct2024.singles
  RENAME COLUMN refer_code TO my_refer_code;

-- If an older unique index was created manually, rename it too:
-- ALTER INDEX outdateddbsnapshotoct2024.ux_singles_refer_code
--   RENAME TO ux_singles_my_refer_code;
