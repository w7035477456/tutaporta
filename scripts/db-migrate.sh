#!/usr/bin/env bash
# Apply pending schema migrations (be/db/migrations/*.sql) to THIS machine's Postgres.
# Same script on Mac and Ubuntu. Each file runs once; applied files are recorded in
# outdateddbsnapshotoct2024.schema_migrations, so re-running is always safe.
#
#   scripts/db-migrate.sh            # apply pending migrations (alias: dbmigrate)
#   scripts/db-migrate.sh --status   # list applied / pending, change nothing
#   scripts/db-migrate.sh --dry-run  # show what would run, change nothing
#
# New migration: be/db/migrations/YYYYMMDD_NN_shortName.sql (sorted by name = run order).
#   - Each file runs in one transaction together with its schema_migrations row
#     (all or nothing). Add the line  -- migrate:no-transaction  for statements that
#     cannot run in a transaction (e.g. CREATE INDEX CONCURRENTLY).
#   - Never edit a file after it was applied anywhere — add a new one instead
#     (an edited file is reported as CHANGED, not re-run).
#   - Write idempotent SQL (IF NOT EXISTS / DROP … IF EXISTS) where you can.
#
# Connection: ~/.ssh/be/.env (or BE_ENV_FILE) DB_HOST / DB_NAME / DB_USER / DB_PASSWORD,
# but always the direct Postgres port (DB_MIGRATE_PORT, default 50010) — never PgBouncer 6432.
# The password stays in the environment (PGPASSWORD); it is never printed or put in argv.
#
# Exit codes: 0 = up to date / applied, 1 = a migration failed, 2 = setup error.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_DIR/be/db/migrations}"
MODE=apply

case "${1:-}" in
  '') ;;
  --status) MODE=status ;;
  --dry-run) MODE=dry ;;
  -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "ERROR: unknown arg: $1 (try --help)" >&2; exit 2 ;;
esac

# shellcheck source=lib/pg-env.sh
. "$SCRIPT_DIR/lib/pg-env.sh"
PGPORT="${DB_MIGRATE_PORT:-50010}"
pg_load_connection_defaults || exit 2
[[ -n "${PGPASSWORD:-}" ]] || { echo "ERROR: DB_PASSWORD not set in $PG_ENV_FILE" >&2; exit 2; }
SCHEMA="$PGSCHEMA"

command -v psql >/dev/null 2>&1 || { echo "ERROR: psql not found in PATH" >&2; exit 2; }
[[ -d "$MIGRATIONS_DIR" ]] || { echo "ERROR: missing $MIGRATIONS_DIR" >&2; exit 2; }

if command -v sha256sum >/dev/null 2>&1; then
  sha() { sha256sum "$1" | cut -d' ' -f1; }
else
  sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
fi

# Hide 'already exists, skipping' NOTICEs from idempotent SQL; warnings and errors still show.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

echo "[db-migrate] $(hostname -s) → $(pg_connection_label)"

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS ${SCHEMA}.schema_migrations (
  filename   text PRIMARY KEY,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user
);" || { echo "ERROR: cannot reach Postgres / create ${SCHEMA}.schema_migrations" >&2; exit 2; }

# filename|checksum per line (works on macOS bash 3.2 — no associative arrays).
APPLIED_LIST="$("${PSQL[@]}" -At -c "SELECT filename || '|' || checksum FROM ${SCHEMA}.schema_migrations")" ||
  { echo "ERROR: cannot read ${SCHEMA}.schema_migrations" >&2; exit 2; }
applied_sum() { printf '%s\n' "$APPLIED_LIST" | awk -F'|' -v n="$1" '$1 == n { print $2; exit }'; }

shopt -s nullglob
files=()
while IFS= read -r f; do files+=("$f"); done < <(printf '%s\n' "$MIGRATIONS_DIR"/*.sql | LC_ALL=C sort)

pending=0 ran=0 changed=0
for path in "${files[@]}"; do
  name="$(basename "$path")"
  if [[ ! "$name" =~ ^[0-9]{8}_[0-9]{2}_[A-Za-z0-9_]+\.sql$ ]]; then
    echo "ERROR: bad migration name '$name' (want YYYYMMDD_NN_shortName.sql)" >&2
    exit 2
  fi
  sum="$(sha "$path")"
  prev="$(applied_sum "$name")"
  if [[ -n "$prev" ]]; then
    if [[ "$prev" != "$sum" ]]; then
      echo "  CHANGED  $name  (edited after it was applied — not re-run; add a new migration instead)"
      changed=$((changed + 1))
    elif [[ $MODE == status ]]; then
      echo "  applied  $name"
    fi
    continue
  fi
  pending=$((pending + 1))
  if [[ $MODE != apply ]]; then
    echo "  PENDING  $name"
    continue
  fi
  echo "  applying $name …"
  record="INSERT INTO ${SCHEMA}.schema_migrations (filename, checksum) VALUES ('${name}', '${sum}')"
  if grep -q -- '-- migrate:no-transaction' "$path"; then
    "${PSQL[@]}" -f "$path" && "${PSQL[@]}" -c "$record"
  else
    "${PSQL[@]}" --single-transaction -f "$path" -c "$record"
  fi
  if [[ $? -ne 0 ]]; then
    echo "FAILED   $name — nothing from this file was recorded; fix it and re-run." >&2
    exit 1
  fi
  ran=$((ran + 1))
done

case $MODE in
  apply) echo "[db-migrate] done: ${ran} applied, $(( ${#files[@]} - pending )) already applied (${changed} changed)." ;;
  *) echo "[db-migrate] ${pending} pending, ${#files[@]} total." ;;
esac
exit 0
