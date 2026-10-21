-- Run ON xbox1 (Primary) as postgres:  sudo -u postgres psql -p 50010 -f setupPrimaryReplication.sql
-- Then set its password interactively (never put it in this repo):
--   sudo -u postgres psql -p 50010 -c "\password replicator"
-- The replication slot xbox3_slot is created by setupReplica.sh on xbox3 (pg_basebackup -C).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
    CREATE ROLE replicator WITH REPLICATION LOGIN;
  END IF;
END
$$;
