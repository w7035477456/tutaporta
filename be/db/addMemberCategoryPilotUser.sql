-- Add PILOTUSER to member_category_enum (signup + admin password bulk update).
-- Uses uppercase label when PUBLIC already exists; otherwise legacy PilotUser.
DO $$
DECLARE
  sch text := 'helloworldjunktest';
  use_uppercase boolean;
  pilot_label text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = 'PUBLIC'
  ) INTO use_uppercase;

  pilot_label := CASE WHEN use_uppercase THEN 'PILOTUSER' ELSE 'PilotUser' END;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = pilot_label
  ) THEN
    EXECUTE format(
      'ALTER TYPE %I.member_category_enum ADD VALUE %L',
      sch,
      pilot_label
    );
  END IF;
END $$;
