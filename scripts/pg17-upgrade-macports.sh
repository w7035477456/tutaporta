#!/usr/bin/env bash
# MacPorts: upgrade postgresql16/defaultdb -> postgresql17/defaultdb, keep port 50010.
# Run on the Mac from any directory. Requires sudo (stop servers, run pg_upgrade as postgres).
#
#   scripts/pg17-upgrade-macports.sh
#   scripts/pg17-upgrade-macports.sh --dry-run
set -euo pipefail

PGPORT="${PGPORT:-50010}"
OLD_DATA="${PG16DATA:-/opt/local/var/db/postgresql16/defaultdb}"
NEW_DATA="${PG17DATA:-/opt/local/var/db/postgresql17/defaultdb}"
OLD_BIN=/opt/local/lib/postgresql16/bin
NEW_BIN=/opt/local/lib/postgresql17/bin
WORKDIR=/tmp/pg17-upgrade-macports

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

die() { echo "ERROR: $*" >&2; exit 1; }
run() { if [[ "$DRY" -eq 1 ]]; then echo "DRY-RUN $*"; else echo "+ $*"; "$@"; fi; }

[[ -x "$OLD_BIN/postgres" ]] || die "missing $OLD_BIN (port install postgresql16 postgresql16-server)"
[[ -x "$NEW_BIN/pg_upgrade" ]] || die "missing $NEW_BIN (port install postgresql17 postgresql17-server)"

echo "== Stop PostgreSQL 16 (MacPorts) =="
if [[ "$DRY" -eq 0 ]]; then
  sudo port unload postgresql16-server 2>/dev/null || true
  sleep 2
  if pgrep -f "postgresql16/bin/postgres" >/dev/null; then
    die "postgresql16 still running — stop it before pg_upgrade"
  fi
fi

echo "== Prepare empty PostgreSQL 17 cluster at $NEW_DATA =="
if [[ "$DRY" -eq 0 ]]; then
  sudo mkdir -p "$(dirname "$NEW_DATA")"
  if [[ -d "$NEW_DATA" ]] && [[ -f "$NEW_DATA/PG_VERSION" ]]; then
    echo "Removing previous $NEW_DATA (re-init for pg_upgrade)"
    sudo rm -rf "$NEW_DATA"
  fi
  sudo mkdir -p "$NEW_DATA"
  sudo chown postgres:postgres "$NEW_DATA" "$(dirname "$NEW_DATA")"
  sudo -u postgres /bin/sh -c "cd /tmp && $NEW_BIN/initdb -D '$NEW_DATA'"
fi

echo "== pg_upgrade (must run with cwd postgres can read — use /tmp) =="
UPGRADE_CMD="cd /tmp && $NEW_BIN/pg_upgrade \
  -b $OLD_BIN \
  -B $NEW_BIN \
  -d $OLD_DATA \
  -D $NEW_DATA \
  -p $PGPORT"

if [[ "$DRY" -eq 1 ]]; then
  echo "DRY-RUN sudo -u postgres /bin/sh -c $(printf %q "$UPGRADE_CMD")"
else
  sudo mkdir -p "$WORKDIR"
  sudo chown postgres:postgres "$WORKDIR"
  sudo -u postgres /bin/sh -c "cd '$WORKDIR' && $NEW_BIN/pg_upgrade \
    -b '$OLD_BIN' \
    -B '$NEW_BIN' \
    -d '$OLD_DATA' \
    -D '$NEW_DATA' \
    -p '$PGPORT'"
fi

echo "== MacPorts select + start PostgreSQL 17 on port $PGPORT =="
if [[ "$DRY" -eq 0 ]]; then
  if ! sudo grep -qE "^port[[:space:]]*=[[:space:]]*$PGPORT" "$NEW_DATA/postgresql.conf"; then
    echo "Setting port = $PGPORT in $NEW_DATA/postgresql.conf"
    sudo -u postgres /bin/sh -c "cd /tmp && echo \"port = $PGPORT\" >> '$NEW_DATA/postgresql.conf'"
  fi
  sudo mkdir -p /opt/local/var/log/postgresql17
  sudo chown postgres:postgres /opt/local/var/log/postgresql17
fi
run sudo port select postgresql postgresql17
if [[ "$DRY" -eq 0 ]]; then
  sudo port unload postgresql16-server 2>/dev/null || true
  sudo port unload postgresql17-server 2>/dev/null || true
  if ! sudo -u postgres /bin/sh -c "cd /tmp && $NEW_BIN/pg_ctl -D '$NEW_DATA' -l /opt/local/var/log/postgresql17/postgres.log start"; then
    echo "pg_ctl start failed — last log lines:" >&2
    sudo tail -30 /opt/local/var/log/postgresql17/postgres.log >&2 || true
    exit 1
  fi
  sudo port load postgresql17-server 2>/dev/null || true
  sleep 2
  if ! lsof -iTCP:"$PGPORT" -sTCP:LISTEN >/dev/null 2>&1; then
    die "nothing listening on TCP $PGPORT — check /opt/local/var/log/postgresql17/postgres.log"
  fi
fi

echo "== Verify =="
echo "  psql -h 127.0.0.1 -p $PGPORT -U test_user1 -d outdatedDBOct2021 -c \"SHOW server_version;\""
echo "  source ~/b && isdbsame"
echo "Optional after you are happy: sudo port uninstall postgresql16-server postgresql16"
