#!/usr/bin/env bash
# Run SQL on Ubuntu (xbox2) Postgres from the Mac, over the f2-style SSH path (deploy-ssh-mac.sh).
#
#   scripts/ubuntu-psql.sh -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
#   scripts/ubuntu-psql.sh -f be/db/loginLogDevice.sql
#   echo "SELECT 1;" | scripts/ubuntu-psql.sh
#   scripts/ubuntu-psql.sh -At -c "SELECT count(*) FROM outdateddbsnapshotoct2024.singles;"
#
# Password: UBUNTU_POSTGRES_PASSWORD in ~/.ssh/be/.env (Mac, outside git). It is sent as the first
# line of the SSH stdin and read into PGPASSWORD remotely, so it never appears in argv / ps on
# either host. Any other psql flags (-At, -x, --csv, …) are passed through.
#
# Overrides: UBUNTU_PG_HOST (127.0.0.1), UBUNTU_PG_PORT (50010), UBUNTU_PG_USER (test_user1),
#            UBUNTU_PG_DB (onlinemallwebsite), UBUNTU_SSH_HOST (lawsen0@192.168.222.202),
#            DEPLOY_SSH_SECRETS (~/.ssh/be/.env).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS="${DEPLOY_SSH_SECRETS:-$HOME/.ssh/be/.env}"
SSH_HOST="${UBUNTU_SSH_HOST:-lawsen0@192.168.222.202}"
PG_HOST="${UBUNTU_PG_HOST:-127.0.0.1}"
PG_PORT="${UBUNTU_PG_PORT:-50010}"
PG_USER="${UBUNTU_PG_USER:-test_user1}"
PG_DB="${UBUNTU_PG_DB:-onlinemallwebsite}"

sql=""
sql_set=0
psql_flags=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) sql+="${2:?-c needs SQL}"$'\n'; sql_set=1; shift 2 ;;
    -f) [[ -r "${2:-}" ]] || { echo "ubuntu-psql: cannot read file: ${2:-}" >&2; exit 2; }
        sql+="$(cat "$2")"$'\n'; sql_set=1; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) psql_flags+=("$1"); shift ;;
  esac
done
if [[ "$sql_set" -eq 0 ]]; then
  [[ -t 0 ]] && { echo "ubuntu-psql: give -c SQL, -f file, or SQL on stdin" >&2; exit 2; }
  sql="$(cat)"$'\n'
fi

[[ -r "$SECRETS" ]] || { echo "ubuntu-psql: secrets file not readable: $SECRETS" >&2; exit 2; }
password="$(sed -n 's/^UBUNTU_POSTGRES_PASSWORD=//p' "$SECRETS" | tail -n 1 | tr -d '\r')"
password="${password%\"}"; password="${password#\"}"
password="${password%\'}"; password="${password#\'}"
[[ -n "$password" ]] || { echo "ubuntu-psql: UBUNTU_POSTGRES_PASSWORD missing in $SECRETS" >&2; exit 2; }

remote_flags=""
for f in ${psql_flags[@]+"${psql_flags[@]}"}; do
  remote_flags+=" $(printf '%q' "$f")"
done
remote_cmd="IFS= read -r PGPASSWORD; export PGPASSWORD; psql -X -v ON_ERROR_STOP=1 \
-h $(printf '%q' "$PG_HOST") -p $(printf '%q' "$PG_PORT") -U $(printf '%q' "$PG_USER") \
-d $(printf '%q' "$PG_DB")${remote_flags} -f -"

{ printf '%s\n' "$password"; printf '%s' "$sql"; } |
  "$SCRIPT_DIR/deploy-ssh-mac.sh" -o ConnectTimeout=25 "$SSH_HOST" "$remote_cmd"
