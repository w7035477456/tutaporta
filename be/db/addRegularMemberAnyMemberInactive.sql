-- Add RegularMember + AnyMember to member_category_enum,
-- and inactive to singles_status (CreateNewMember.sh).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = 'RegularMember'
  ) THEN
    ALTER TYPE helloworldjunktest.member_category_enum ADD VALUE 'RegularMember';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = 'AnyMember'
  ) THEN
    ALTER TYPE helloworldjunktest.member_category_enum ADD VALUE 'AnyMember';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'singles_status'
      AND e.enumlabel = 'inactive'
  ) THEN
    ALTER TYPE helloworldjunktest.singles_status ADD VALUE 'inactive';
  END IF;
END $$;
