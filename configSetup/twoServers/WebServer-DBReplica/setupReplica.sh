#!/usr/bin/env bash
# ONE-TIME: turn xbox3's Postgres into a streaming replica of xbox1.
# Run ON xbox3 after install.sh on xbox1 has finished (Primary up, replicator password set):
#   cd ~/code/main/configSetup/twoServers/WebServer-DBReplica && sudo ./setupReplica.sh
# The existing xbox3 data dir is moved aside (not deleted) and replaced by a copy of the Primary.
set -euo pipefail
cd "$(dirname "$0")"

[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
PRIMARY=192.168.202.201
PGDATA=/var/lib/postgresql/16/main
PGPASS=/var/lib/postgresql/.pgpass

read -r -p "This replaces $PGDATA with a copy of the Primary on $PRIMARY. Type YES to continue: " ok
[[ "$ok" == "YES" ]] || { echo "Aborted"; exit 1; }

read -r -s -p "replicator password (set on xbox1): " RPW; echo
umask 077
printf '%s:50010:*:replicator:%s\n' "$PRIMARY" "$RPW" > "$PGPASS"
unset RPW
chown postgres:postgres "$PGPASS"; chmod 600 "$PGPASS"

systemctl stop postgresql
if [[ -d "$PGDATA" ]]; then
  mv "$PGDATA" "$PGDATA.pre-replica-$(date +%Y%m%d%H%M%S)"
fi
install -d -o postgres -g postgres -m 700 "$PGDATA"

# -C -S creates slot xbox3_slot on the Primary; drop it there first if re-running:
#   sudo -u postgres psql -p 50010 -c "SELECT pg_drop_replication_slot('xbox3_slot')"
sudo -u postgres env PGPASSFILE="$PGPASS" pg_basebackup \
  -h "$PRIMARY" -p 50010 -U replicator -w \
  -D "$PGDATA" -X stream -C -S xbox3_slot -P
sudo -u postgres touch "$PGDATA/standby.signal"

install -m 644 -o postgres -g postgres postgresql.conf /etc/postgresql/16/main/postgresql.conf
install -m 640 -o postgres -g postgres pg_hba.conf     /etc/postgresql/16/main/pg_hba.conf
systemctl start postgresql

sleep 3
echo "pg_is_in_recovery (expect t):"
sudo -u postgres psql -p 50010 -Atc "SELECT pg_is_in_recovery()"
echo "On xbox1 check: sudo -u postgres psql -p 50010 -c \"SELECT client_addr, state, sync_state FROM pg_stat_replication\""
