-- helloworldjunktest.singles — backfill my_refer_code from phone (Primary only; collisions OK)
-- Matches be/utils/referCodeFromPhone.js (SHA-256 of 10-digit phone, mod 1_000_000).
-- Requires pgcrypto for digest(). Collisions allowed — drop unique index if present.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP INDEX IF EXISTS helloworldjunktest.ux_singles_refer_code;

UPDATE helloworldjunktest.singles
SET my_refer_code = LPAD(
  (('x' || substr(encode(digest(
    CASE
      WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
        AND left(regexp_replace(phone, '\D', '', 'g'), 1) = '1'
      THEN right(regexp_replace(phone, '\D', '', 'g'), 10)
      ELSE regexp_replace(phone, '\D', '', 'g')
    END,
    'sha256'
  ), 'hex'), 1, 8))::bit(32)::bigint % 1000000)::text,
  6,
  '0'
)
WHERE phone IS NOT NULL
  AND my_refer_code IS NULL
  AND length(
    CASE
      WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11
        AND left(regexp_replace(phone, '\D', '', 'g'), 1) = '1'
      THEN right(regexp_replace(phone, '\D', '', 'g'), 10)
      ELSE regexp_replace(phone, '\D', '', 'g')
    END
  ) = 10;
