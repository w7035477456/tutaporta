#!/usr/bin/env bash
# Upgrade local Mac Postgres 16 -> 17 (Homebrew or MacPorts). Run on the Mac with shell init (source ~/b).
set -euo pipefail

PGPORT="${PGPORT:-50010}"
PGUSER="${PGUSER:-test_user1}"
PGDATABASE="${PGDATABASE:-outdatedDBOct2021}"

info() { echo "[pg17-mac] $*"; }

if command -v brew >/dev/null 2>&1 && brew list postgresql@16 &>/dev/null; then
  info "Homebrew postgresql@16 detected"
  brew install postgresql@17
  brew services stop postgresql@16 || true
  OLD_DATA="$(brew --prefix postgresql@16)/var/postgresql@16"
  NEW_DATA="$(brew --prefix postgresql@17)/var/postgresql@17"
  mkdir -p "$NEW_DATA"
  initdb -D "$NEW_DATA" 2>/dev/null || true
  pg_upgrade \
    -b "$(brew --prefix postgresql@16)/bin" \
    -B "$(brew --prefix postgresql@17)/bin" \
    -d "$OLD_DATA" \
    -D "$NEW_DATA" \
    -p "$PGPORT"
  brew services start postgresql@17
  info "point shell at PG 17: brew link postgresql@17 --force (if needed)"
  exit 0
fi

if [[ -x /opt/local/lib/postgresql16/bin/pg_ctl ]]; then
  info "MacPorts postgresql16 detected — install postgresql17 and run pg_upgrade manually:"
  echo "  sudo port install postgresql17 postgresql17-server"
  echo "  then pg_upgrade with MacPorts bin paths and your data_directory under /opt/local/var/db/postgresql16/"
  exit 0
fi

info "Could not detect Homebrew @16 or MacPorts postgresql16. Install PG 17 and pg_upgrade from your package manager."
exit 1
