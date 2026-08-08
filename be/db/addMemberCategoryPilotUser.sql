-- Add PilotUser to member_category_enum (signup + admin password bulk update).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'helloworldjunktest'
      AND t.typname = 'member_category_enum'
      AND e.enumlabel = 'PilotUser'
  ) THEN
    ALTER TYPE helloworldjunktest.member_category_enum ADD VALUE 'PilotUser';
  END IF;
END $$;
