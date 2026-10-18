-- Raffle Refer Code entered at signup: credit the referrer (singles.raffle_refer_code owner) once per new member.
ALTER TABLE outdateddbsnapshotoct2024.singles
  ADD COLUMN IF NOT EXISTS raffle_refer_credit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raffle_refer_by_code varchar(4);

-- Code typed on /register, held until the account is actually created (email link / SMS / Google finish).
CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.raffle_refer_pending (
  email text PRIMARY KEY,
  raffle_refer_code varchar(4) NOT NULL CHECK (raffle_refer_code ~ '^[0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
