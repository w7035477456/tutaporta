-- All Singles → "AI Filter": cached AI match score of one candidate for one viewer and one set of
-- picked categories (age, hobbies, intro, career, location, ethnicity). input_hash covers both
-- profiles' category facts, so any profile change makes the cached score stale and it is re-scored.

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.ai_match_score (
  viewer_singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  candidate_singles_id bigint NOT NULL
    REFERENCES outdateddbsnapshotoct2024.singles (singles_id) ON DELETE CASCADE,
  categories_key text NOT NULL,
  input_hash text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason text NOT NULL DEFAULT '',
  llm_model text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_singles_id, candidate_singles_id, categories_key)
);

CREATE INDEX IF NOT EXISTS ai_match_score_candidate_idx
  ON outdateddbsnapshotoct2024.ai_match_score (candidate_singles_id);
