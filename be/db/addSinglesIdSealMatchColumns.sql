-- ID seal on the header profile photo requires both scores > 80 (be/utils/idSeal.js).
-- Followed by consolidateIdSealMatchColumns.sql (DEFAULT 0 NOT NULL, drops the old score columns).
ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS profile_livescan_match numeric(5,2),
  ADD COLUMN IF NOT EXISTS profile_dl_match numeric(5,2);

COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.profile_livescan_match IS
  'Percent match of the live face scan to BOTH the profile photo and the driver license (lower of the two).';
COMMENT ON COLUMN outdateddbsnapshotoct2024.singles.profile_dl_match IS
  'Percent match of the profile photo to the driver license face.';
