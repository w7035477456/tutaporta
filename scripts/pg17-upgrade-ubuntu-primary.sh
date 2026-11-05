#!/usr/bin/env bash
# Upgrade Postgres 16/main -> 17/main on Ubuntu (port 50010). Run as root on the DB host.
# Stops PM2 for lawsen0 first if pm2 is in PATH for that user.
set -euo pipefail

APP_USER="${APP_USER:-lawsen0}"
PG_PORT="${PG_PORT:-50010}"

info() { echo "[pg17-upgrade] $*"; }

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if command -v runuser >/dev/null 2>&1; then
  runuser -u "$APP_USER" -- bash -lc 'command -v pm2 >/dev/null && pm2 stop tutamallPM2Process || true'
else
  su - "$APP_USER" -c 'command -v pm2 >/dev/null && pm2 stop tutamallPM2Process || true'
fi

info "installing postgresql-17..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y postgresql-17 postgresql-client-17

if ! sudo -u postgres psql -p "$PG_PORT" -Atqc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1; then
  sudo -u postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE postgres WITH SUPERUSER LOGIN;"
fi

if ! pg_lsclusters -h | awk '$1 == "16" && $2 == "main" { found=1 } END { exit !found }'; then
  if pg_lsclusters -h | awk '$1 == "17" && $2 == "main" { found=1 } END { exit !found }'; then
    info "17/main already present"
  else
    info "no 16/main cluster — current:"
    pg_lsclusters -h
    exit 1
  fi
else
  info "stripping ser/garbage_collector pg_* memberships (pg_dumpall grantor workaround)..."
  sudo -u postgres psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -c "
    REVOKE pg_read_all_data, pg_write_all_data, pg_monitor, pg_read_all_settings, pg_read_all_stats,
      pg_stat_scan_tables, pg_read_server_files, pg_write_server_files, pg_execute_server_program,
      pg_signal_backend, pg_checkpoint, pg_use_reserved_connections, pg_create_subscription
      FROM ser CASCADE;
    REVOKE pg_read_all_data, pg_write_all_data FROM garbage_collector CASCADE;
  " || true
  info "upgrading cluster 16 main -> 17 (this stops postgres briefly)..."
  pg_upgradecluster -v 17 16 main
fi

CONF="/etc/postgresql/17/main/postgresql.conf"
HBA="/etc/postgresql/17/main/pg_hba.conf"
if [[ -f "$CONF" ]] && ! grep -qE '^summarize_wal\s*=' "$CONF"; then
  echo "summarize_wal = on" >> "$CONF"
  info "enabled summarize_wal in $CONF"
fi
if [[ -f "$HBA" ]]; then
  grep -q 'replication.*test_user1.*127.0.0.1' "$HBA" || \
    echo 'host replication test_user1 127.0.0.1/32 scram-sha-256' >> "$HBA"
  grep -q 'local replication test_user1' "$HBA" || \
    echo 'local replication test_user1 peer' >> "$HBA"
fi

systemctl restart postgresql@17-main
sleep 2

ver="$(sudo -u postgres psql -p "$PG_PORT" -Atc 'SHOW server_version_num;' 2>/dev/null || true)"
info "server_version_num=$ver (170000 expected for PG 17)"

pg_lsclusters -h
pg_basebackup --version

if command -v runuser >/dev/null 2>&1; then
  runuser -u "$APP_USER" -- bash -lc 'command -v pm2 >/dev/null && pm2 restart tutamallPM2Process || true'
else
  su - "$APP_USER" -c 'command -v pm2 >/dev/null && pm2 restart tutamallPM2Process || true'
fi

info "done"
