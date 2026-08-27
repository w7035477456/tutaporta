-- Add REGULARMEMBER + ANYMEMBER to member_category_enum,
-- and inactive to singles_status (CreateNewMember.sh).
-- Uses uppercase labels when PUBLIC already exists; otherwise legacy PascalCase.
DO $$
DECLARE
  sch text := 'helloworldjunktest';
  use_uppercase boolean;
  regular_label text;
  any_label text;
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

  regular_label := CASE WHEN use_uppercase THEN 'REGULARMEMBER' ELSE 'RegularMember' END;
  any_label := CASE WHEN use_uppercase THEN 'ANYMEMBER' ELSE 'AnyMember' END;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = regular_label
  ) THEN
    EXECUTE format(
      'ALTER TYPE %I.member_category_enum ADD VALUE %L',
      sch,
      regular_label
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = any_label
  ) THEN
    EXECUTE format(
      'ALTER TYPE %I.member_category_enum ADD VALUE %L',
      sch,
      any_label
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = sch
      AND t.typname = 'singles_status'
      AND e.enumlabel = 'inactive'
  ) THEN
    ALTER TYPE helloworldjunktest.singles_status ADD VALUE 'inactive';
  END IF;
END $$;
