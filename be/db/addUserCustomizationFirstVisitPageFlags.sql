-- First-visit welcome popups for Picks & Posts, Acquaint & Buddies, Received Bio Req.
-- null = not yet shown; true = welcome popup was displayed once.

ALTER TABLE helloworldjunktest.user_customization
  ADD COLUMN IF NOT EXISTS first_visit_picksposts boolean NULL,
  ADD COLUMN IF NOT EXISTS first_visit_acquaintbuddies boolean NULL,
  ADD COLUMN IF NOT EXISTS first_visit_rec_biorequest boolean NULL;

COMMENT ON COLUMN helloworldjunktest.user_customization.first_visit_picksposts IS
  'Picks & Posts first-visit welcome popup shown (null = pending, true = done).';
COMMENT ON COLUMN helloworldjunktest.user_customization.first_visit_acquaintbuddies IS
  'Acquaint & Buddies first-visit welcome popup shown (null = pending, true = done).';
COMMENT ON COLUMN helloworldjunktest.user_customization.first_visit_rec_biorequest IS
  'Received Bio Req first-visit welcome popup shown (null = pending, true = done).';
