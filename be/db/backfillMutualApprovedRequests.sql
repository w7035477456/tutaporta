-- Backfill mutual Acquaint. & Buddies rows for already-approved bio requests.
-- When A→B has brief/full requested + approve, ensure B→A exists with the same
-- request+approval so the approver also sees the requester on /vettedFriends.
-- Does not touch paid flags (viewer still pays tokens to unlock bio view).

BEGIN;

-- Full bio (Buddies) reciprocal
INSERT INTO helloworldjunktest.requests (
  requests_id,
  singles_id_from,
  singles_id_to,
  full_bio_request,
  full_bio_request_approval,
  interested,
  updated_at
)
SELECT
  COALESCE((SELECT MAX(rmax.requests_id) FROM helloworldjunktest.requests rmax), 0)
    + ROW_NUMBER() OVER (ORDER BY src.requests_id),
  src.singles_id_to,
  src.singles_id_from,
  'requested',
  'approve',
  'true',
  CURRENT_TIMESTAMP
FROM helloworldjunktest.requests src
WHERE LOWER(BTRIM(COALESCE(src.full_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(src.full_bio_request_approval::text, ''))) IN ('approve', 'approved')
  AND NOT EXISTS (
    SELECT 1
    FROM helloworldjunktest.requests rev
    WHERE rev.singles_id_from = src.singles_id_to
      AND rev.singles_id_to = src.singles_id_from
  );

UPDATE helloworldjunktest.requests rev
SET full_bio_request = 'requested',
    full_bio_request_approval = 'approve',
    interested = 'true',
    updated_at = CURRENT_TIMESTAMP
FROM helloworldjunktest.requests src
WHERE src.singles_id_from = rev.singles_id_to
  AND src.singles_id_to = rev.singles_id_from
  AND LOWER(BTRIM(COALESCE(src.full_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(src.full_bio_request_approval::text, ''))) IN ('approve', 'approved')
  AND (
    LOWER(BTRIM(COALESCE(rev.full_bio_request::text, 'notrequested'))) <> 'requested'
    OR LOWER(BTRIM(COALESCE(rev.full_bio_request_approval::text, ''))) NOT IN ('approve', 'approved')
  );

-- Brief bio (Acquaintance) reciprocal
INSERT INTO helloworldjunktest.requests (
  requests_id,
  singles_id_from,
  singles_id_to,
  brief_bio_request,
  brief_bio_request_approval,
  interested,
  updated_at
)
SELECT
  COALESCE((SELECT MAX(rmax.requests_id) FROM helloworldjunktest.requests rmax), 0)
    + ROW_NUMBER() OVER (ORDER BY src.requests_id),
  src.singles_id_to,
  src.singles_id_from,
  'requested',
  'approve',
  'true',
  CURRENT_TIMESTAMP
FROM helloworldjunktest.requests src
WHERE LOWER(BTRIM(COALESCE(src.brief_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(src.brief_bio_request_approval::text, ''))) IN ('approve', 'approved')
  AND NOT EXISTS (
    SELECT 1
    FROM helloworldjunktest.requests rev
    WHERE rev.singles_id_from = src.singles_id_to
      AND rev.singles_id_to = src.singles_id_from
  );

UPDATE helloworldjunktest.requests rev
SET brief_bio_request = 'requested',
    brief_bio_request_approval = 'approve',
    interested = 'true',
    updated_at = CURRENT_TIMESTAMP
FROM helloworldjunktest.requests src
WHERE src.singles_id_from = rev.singles_id_to
  AND src.singles_id_to = rev.singles_id_from
  AND LOWER(BTRIM(COALESCE(src.brief_bio_request::text, 'notrequested'))) = 'requested'
  AND LOWER(BTRIM(COALESCE(src.brief_bio_request_approval::text, ''))) IN ('approve', 'approved')
  AND (
    LOWER(BTRIM(COALESCE(rev.brief_bio_request::text, 'notrequested'))) <> 'requested'
    OR LOWER(BTRIM(COALESCE(rev.brief_bio_request_approval::text, ''))) NOT IN ('approve', 'approved')
  );

COMMIT;
