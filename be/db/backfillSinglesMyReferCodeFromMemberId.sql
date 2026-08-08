-- helloworldjunktest.singles — set my_refer_code from member_id hash (Primary only)
-- Matches be/utils/referCodeFromMemberId.js (SHA-256 of member_id text, mod 1_000_000).
-- Replaces phone-based my_refer_code values.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE helloworldjunktest.singles
SET my_refer_code = LPAD(
  (
    (
      ('x' || substr(encode(digest(member_id::text, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint
    ) % 1000000
  )::text,
  6,
  '0'
),
updated_at = CURRENT_TIMESTAMP
WHERE member_id IS NOT NULL;
