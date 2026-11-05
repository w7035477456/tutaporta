#!/usr/bin/env bash
# Diagnose / start MacPorts PostgreSQL 17 on port 50010. Run: sudo scripts/mac-pg17-start-check.sh
set -euo pipefail

PGPORT="${PGPORT:-50010}"
DATA=/opt/local/var/db/postgresql17/defaultdb
LOG=/opt/local/var/log/postgresql17/postgres.log
BIN=/opt/local/lib/postgresql17/bin

[[ "${EUID:-0}" -eq 0 ]] || { echo "Run: sudo $0" >&2; exit 1; }

mkdir -p /opt/local/var/log/postgresql17
chown postgres:postgres /opt/local/var/log/postgresql17

echo "== Data directory =="
ls -la "$DATA" | head -5
cat "$DATA/PG_VERSION" 2>/dev/null || echo "MISSING PG_VERSION — pg_upgrade may not have finished"

echo
echo "== port lines in postgresql.conf =="
grep -nE '^[[:space:]]*port[[:space:]]*=' "$DATA/postgresql.conf" || true

echo
echo "== listen_addresses =="
grep -nE '^[[:space:]]*listen_addresses' "$DATA/postgresql.conf" || true

echo
echo "== Stop any postgres =="
port unload postgresql16-server 2>/dev/null || true
port unload postgresql17-server 2>/dev/null || true
pkill -f 'postgresql16/bin/postgres' 2>/dev/null || true
pkill -f 'postgresql17/bin/postgres' 2>/dev/null || true
sleep 1

echo
echo "== pg_ctl start (postgres user, cwd /tmp) =="
chown postgres:postgres "$DATA/postgresql.conf" "$DATA/pg_hba.conf" 2>/dev/null || true
if ! sudo -u postgres /bin/sh -c "cd /tmp && ${BIN}/pg_ctl -D '${DATA}' -l '${LOG}' -w start"; then
  echo "pg_ctl start FAILED"
  echo "---- $LOG ----"
  tail -80 "$LOG" 2>/dev/null || echo "(log empty)"
  exit 1
fi

echo
echo "== Listening =="
lsof -iTCP:"$PGPORT" -sTCP:LISTEN || echo "NOT listening on $PGPORT"
sudo -u postgres "$BIN/psql" -p "$PGPORT" -d postgres -Atc 'SHOW server_version;' 2>/dev/null || \
  sudo -u postgres "$BIN/psql" -h 127.0.0.1 -p "$PGPORT" -d postgres -Atc 'SHOW server_version;' || true

echo
echo "If pg_upgrade left scripts in /tmp, run as postgres: ./analyze_new_cluster.sh"
