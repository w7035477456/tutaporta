-- Reserved system tools admin row (login id "admin" / global tools password).
-- Status blank + non-public email keeps this row out of normal member listings.
-- DELETE is blocked by trigger (defense in depth; app also rejects mutations).

INSERT INTO outdateddbsnapshotoct2024.singles (
  member_id,
  email,
  phone,
  password_hash,
  alias,
  member_category,
  status,
  theme,
  my_refer_code,
  refer_by_code,
  created_at,
  updated_at
)
SELECT
  999999,
  'tools-admin@vsingles.internal',
  '+19999999999',
  COALESCE(
    (SELECT g.password_hash FROM outdateddbsnapshotoct2024.global g WHERE g.id = 1 LIMIT 1),
    '$2b$12$toolsadminplaceholderhashnotusedforloginxxxxxxxxxxxxxxxxxxxx'
  ),
  'Admin',
  'ADMIN'::outdateddbsnapshotoct2024.member_category_enum,
  'blank'::outdateddbsnapshotoct2024.singles_status,
  'coffey dark',
  '999999',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM outdateddbsnapshotoct2024.singles s
  WHERE lower(s.email::text) = lower('tools-admin@vsingles.internal')
);

CREATE OR REPLACE FUNCTION outdateddbsnapshotoct2024.prevent_system_tools_admin_singles_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(COALESCE(OLD.email::text, '')) = lower('tools-admin@vsingles.internal') THEN
    RAISE EXCEPTION 'System tools admin account cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_system_tools_admin_singles_delete ON outdateddbsnapshotoct2024.singles;

CREATE TRIGGER trg_prevent_system_tools_admin_singles_delete
BEFORE DELETE ON outdateddbsnapshotoct2024.singles
FOR EACH ROW
EXECUTE FUNCTION outdateddbsnapshotoct2024.prevent_system_tools_admin_singles_delete();
