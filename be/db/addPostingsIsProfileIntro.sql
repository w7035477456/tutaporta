-- Postings saved from the /myStory AI profile writer ("Let's write your profile together").
-- The member's newest intro is pinned to the top of their feed and labeled "Pinned · My Intro".
ALTER TABLE outdateddbsnapshotoct2024.postings
  ADD COLUMN IF NOT EXISTS is_profile_intro boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_postings_profile_intro
  ON outdateddbsnapshotoct2024.postings (singles_id, created_at DESC, post_id DESC)
  WHERE is_profile_intro;
