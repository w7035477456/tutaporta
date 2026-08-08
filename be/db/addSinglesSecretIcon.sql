-- Mac dev (Primary):
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addSinglesSecretIcon.sql

ALTER TABLE helloworldjunktest.singles
  ADD COLUMN IF NOT EXISTS secret_icon text;

COMMENT ON COLUMN helloworldjunktest.singles.secret_icon IS
  'SHA-256 hex hash of lowercase Font Awesome 5 object icon name chosen at signup (e.g. bed -> hash of ''bed'').';
