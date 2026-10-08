-- DEPRECATED: video_tutorial_tutanotes moved to outdateddbsnapshotoct2024.global.
-- Use be/db/addGlobalVideoTutorialTutanotes.sql instead (adds global column + drops singles column).

-- Kept only so older docs that point here do not leave a misleading "add to singles" path.
-- No-op when the global migration has already run.
SELECT 1;
