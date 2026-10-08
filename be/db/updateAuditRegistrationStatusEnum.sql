-- outdateddbsnapshotoct2024.audit_registration_status — replace enum values (Primary only).
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/updateAuditRegistrationStatusEnum.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'outdateddbsnapshotoct2024'
      AND t.typname = 'audit_registration_status'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'outdateddbsnapshotoct2024'
        AND t.typname = 'audit_registration_status'
        AND e.enumlabel = 'new'
    ) THEN
      RETURN;
    END IF;

    ALTER TABLE outdateddbsnapshotoct2024.audit_registrations
      ALTER COLUMN status TYPE text USING status::text;

    DROP TYPE outdateddbsnapshotoct2024.audit_registration_status;

    CREATE TYPE outdateddbsnapshotoct2024.audit_registration_status AS ENUM (
      'change',
      'new',
      'cancel',
      'suspend',
      'other'
    );

    ALTER TABLE outdateddbsnapshotoct2024.audit_registrations
      ALTER COLUMN status TYPE outdateddbsnapshotoct2024.audit_registration_status
      USING (
        CASE status::text
          WHEN 'active' THEN 'new'::outdateddbsnapshotoct2024.audit_registration_status
          WHEN 'canceled' THEN 'cancel'::outdateddbsnapshotoct2024.audit_registration_status
          WHEN 'suspended' THEN 'suspend'::outdateddbsnapshotoct2024.audit_registration_status
          ELSE 'other'::outdateddbsnapshotoct2024.audit_registration_status
        END
      );
  ELSE
    CREATE TYPE outdateddbsnapshotoct2024.audit_registration_status AS ENUM (
      'change',
      'new',
      'cancel',
      'suspend',
      'other'
    );
  END IF;
END $$;
