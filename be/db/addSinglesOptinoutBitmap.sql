-- outdateddbsnapshotoct2024.singles.optinout_bitmap: 8-bit mall app opt-in mask.
--   bit 0 (1) = TutaDates, bit 1 (2) = TutaNotes, bit 2 (4) = TutaPhotos, bits 3–7 reserved.
-- New accounts default to 7 (all three opted in). A member appears on /allSingles and the
-- dating menus only when bit 0 is set AND status = 'active'.
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/addSinglesOptinoutBitmap.sql
-- Ubuntu: scripts/ubuntu-psql.sh -f be/db/addSinglesOptinoutBitmap.sql
-- Prod Primary only.

ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS optinout_bitmap smallint NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'singles_optinout_bitmap_range_chk'
      AND conrelid = 'outdateddbsnapshotoct2024.singles'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.singles
      ADD CONSTRAINT singles_optinout_bitmap_range_chk
      CHECK (optinout_bitmap BETWEEN 0 AND 255);
  END IF;
END $$;

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.optinout_bitmap IS
  '8-bit mall app opt-in mask: 1 = TutaDates, 2 = TutaNotes, 4 = TutaPhotos (bits 3-7 reserved). '
  'Default 7. Listed on /allSingles + dating menus only when (optinout_bitmap & 1) = 1 AND status = active.';

-- Carry over the mall enrollment popup choices previously kept on user_customization.
UPDATE outdateddbsnapshotoct2024.singles s
SET optinout_bitmap =
      (CASE WHEN uc.tuta_dates_enabled IS FALSE THEN 0 ELSE 1 END)
    | (CASE WHEN uc.tuta_notes_enabled IS FALSE THEN 0 ELSE 2 END)
    | (CASE WHEN uc.tuta_albums_enabled IS FALSE THEN 0 ELSE 4 END)
FROM outdateddbsnapshotoct2024.user_customization uc
WHERE uc.singles_id = s.singles_id
  AND s.optinout_bitmap = 7;

-- Unchecking TutaDates used to flip status active → inactive. inactive now blocks login,
-- so restore those members to active (TutaDates opt-out lives in optinout_bitmap).
UPDATE outdateddbsnapshotoct2024.singles s
SET status = 'active'::outdateddbsnapshotoct2024.singles_status,
    updated_at = CURRENT_TIMESTAMP
FROM outdateddbsnapshotoct2024.user_customization uc
WHERE uc.singles_id = s.singles_id
  AND uc.tuta_dates_enabled IS FALSE
  AND s.status = 'inactive'::outdateddbsnapshotoct2024.singles_status;

-- Verify:
-- SELECT optinout_bitmap, status, COUNT(*) FROM outdateddbsnapshotoct2024.singles GROUP BY 1, 2 ORDER BY 1, 2;
