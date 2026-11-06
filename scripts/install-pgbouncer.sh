#!/usr/bin/env bash
# Install PgBouncer config from repo and wire app to 127.0.0.1:6432.
#
# Mac dev (Homebrew or MacPorts — Intel Macs often use MacPorts when brew is gone):
#   brew install pgbouncer
#   # or: sudo port install pgbouncer
#   ./scripts/install-pgbouncer.sh --mac
#   # Add to ~/.ssh/be/.env: DB_HOST=127.0.0.1  DB_PORT=6432
#   # Start: brew services start pgbouncer  OR  pgbouncer -d "$REPO/configSetup/pgbouncer/pgbouncer.mac.ini"
#
# Ubuntu (web server with local replica on 50010):
#   sudo ./scripts/install-pgbouncer.sh
#   # Update ~/.ssh/be/.env DB_PORT=6432, pm2 restart tutamallPM2Process
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INI_SRC="$REPO_ROOT/configSetup/pgbouncer/pgbouncer.ini"
MAC_INI="$REPO_ROOT/configSetup/pgbouncer/pgbouncer.mac.ini"

# shellcheck source=lib/pg-env.sh
source "$REPO_ROOT/scripts/lib/pg-env.sh"

print_userlist() {
  pg_env_require_readable || exit 1
  local user pass
  user="$(pg_read_env DB_USER)"
  user="${user:-test_user1}"
  pass="$(pg_read_env DB_PASSWORD)"
  if [[ -z "$pass" ]]; then
    echo "DB_PASSWORD not set in $PG_ENV_FILE" >&2
    exit 1
  fi
  printf '"%s" "%s"\n' "$user" "$pass"
}

write_mac_ini() {
  mkdir -p "$(dirname "$MAC_INI")"
  sed "s|auth_file = /etc/pgbouncer/userlist.txt|auth_file = ${HOME}/.ssh/be/pgbouncer-userlist.txt|" "$INI_SRC" > "$MAC_INI"
  print_userlist > "${HOME}/.ssh/be/pgbouncer-userlist.txt"
  chmod 600 "${HOME}/.ssh/be/pgbouncer-userlist.txt"
  echo "Wrote $MAC_INI and ~/.ssh/be/pgbouncer-userlist.txt"
}

install_mac_hint() {
  if command -v port >/dev/null 2>&1; then
    echo "  sudo port install pgbouncer" >&2
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "  brew install pgbouncer" >&2
  fi
  if ! command -v port >/dev/null 2>&1 && ! command -v brew >/dev/null 2>&1; then
    echo "  brew install pgbouncer   # or: sudo port install pgbouncer" >&2
  fi
}

install_mac() {
  if ! command -v pgbouncer >/dev/null 2>&1; then
    echo "Install PgBouncer first:" >&2
    install_mac_hint
    exit 1
  fi
  write_mac_ini
  pkill -x pgbouncer 2>/dev/null || true
  pgbouncer -d "$MAC_INI"
  echo "PgBouncer running (Mac). Set DB_HOST=127.0.0.1 DB_PORT=6432 in ~/.ssh/be/.env and restart beall."
}

install_ubuntu() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Ubuntu install requires sudo: sudo $0" >&2
    exit 1
  fi
  apt-get update -qq
  apt-get install -y pgbouncer
  install -m 644 "$INI_SRC" /etc/pgbouncer/pgbouncer.ini
  print_userlist > /etc/pgbouncer/userlist.txt
  chmod 600 /etc/pgbouncer/userlist.txt
  chown postgres:postgres /etc/pgbouncer/userlist.txt 2>/dev/null || true
  systemctl enable pgbouncer
  systemctl restart pgbouncer
  echo "PgBouncer on 127.0.0.1:6432. Set DB_PORT=6432 in ~/.ssh/be/.env and pm2 restart tutamallPM2Process."
}

case "${1:-}" in
  --print-userlist) print_userlist ;;
  --mac) install_mac ;;
  --write-mac-ini) write_mac_ini ;;
  '') install_ubuntu ;;
  *)
    echo "Usage: $0 | --mac | --write-mac-ini | --print-userlist" >&2
    exit 1
    ;;
esac
