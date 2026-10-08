-- outdateddbsnapshotoct2024.audit_registrations — registration audit trail (run on Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/addAuditRegistrations.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'audit_registration_status'
  ) THEN
    CREATE TYPE outdateddbsnapshotoct2024.audit_registration_status AS ENUM (
      'change',
      'new',
      'cancel',
      'suspend',
      'other'
    );
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS outdateddbsnapshotoct2024.audit_registrations_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS outdateddbsnapshotoct2024.audit_registrations (
  audit_registration_id bigint NOT NULL
    DEFAULT nextval('outdateddbsnapshotoct2024.audit_registrations_id_seq'::regclass),
  singles_id bigint,
  email text NOT NULL,
  phone text NOT NULL,
  status outdateddbsnapshotoct2024.audit_registration_status NOT NULL,
  date_update timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_registrations_pkey PRIMARY KEY (audit_registration_id)
);

CREATE INDEX IF NOT EXISTS audit_registrations_singles_id_idx
  ON outdateddbsnapshotoct2024.audit_registrations (singles_id);

CREATE INDEX IF NOT EXISTS audit_registrations_email_idx
  ON outdateddbsnapshotoct2024.audit_registrations (email);

CREATE INDEX IF NOT EXISTS audit_registrations_date_update_idx
  ON outdateddbsnapshotoct2024.audit_registrations (date_update DESC);
