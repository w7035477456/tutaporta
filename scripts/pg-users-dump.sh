#!/bin/bash
# Dump helloworldjunktest.singles identity rows to stdout (TSV) for Mac↔Ubuntu compare.
# Run on Mac or Ubuntu; reads ~/.ssh/be/.env (or BE_ENV_FILE).
#
# Columns (tab-separated, one user per line, sorted by lower(email)):
#   email_key \t email \t member_id \t alias \t created_at_iso
#
#   bash scripts/pg-users-dump.sh > /tmp/users.tsv
set -uo pipefail

SCRIPT_DIR="${PG_SCHEMA_SCRIPT_DIR:-}"
if [[ -z "$SCRIPT_DIR" || ! -f "${SCRIPT_DIR}/lib/pg-env.sh" ]]; then
  _src="${BASH_SOURCE[0]:-}"
  if [[ -n "$_src" && "$_src" != "-" && -f "$_src" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$_src")" && pwd)"
  else
    SCRIPT_DIR="${HOME}/code/main/scripts"
  fi
fi
if [[ -f "${SCRIPT_DIR}/lib/pg-env.sh" ]]; then
  # shellcheck source=lib/pg-env.sh
  . "${SCRIPT_DIR}/lib/pg-env.sh"
else
  PG_ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
  pg_env_require_readable() { [[ -r "$PG_ENV_FILE" ]] || { echo "ERROR: cannot read $PG_ENV_FILE" >&2; return 1; }; }
  pg_read_env() {
    sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$PG_ENV_FILE" \
      | tail -n1 \
      | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
  }
  pg_load_connection_defaults() {
    pg_env_require_readable || return 1
    PGHOST="${PGHOST:-$(pg_read_env DB_HOST)}"
    PGPORT="${PGPORT:-$(pg_read_env DB_PORT)}"
    PGDATABASE="${PGDATABASE:-$(pg_read_env DB_NAME)}"
    PGUSER="${PGUSER:-$(pg_read_env DB_USER)}"
    PGPASSWORD="${PGPASSWORD:-$(pg_read_env DB_PASSWORD)}"
    PGSCHEMA="${PGSCHEMA:-$(pg_read_env DB_SCHEMA)}"
    PGSCHEMA="${PGSCHEMA:-$(pg_read_env VSINGLES_SCHEMA)}"
    PGSCHEMA="${PGSCHEMA:-helloworldjunktest}"
    export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSCHEMA
  }
fi

pg_load_connection_defaults || exit 2

find_psql() {
  if command -v psql >/dev/null 2>&1; then
    command -v psql
    return 0
  fi
  local candidate
  for candidate in /usr/lib/postgresql/*/bin/psql /usr/local/bin/psql /opt/homebrew/bin/psql; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  echo "ERROR: psql not found on $(hostname)" >&2
  return 1
}

[[ -n "${PGHOST:-}" && -n "${PGPORT:-}" && -n "${PGDATABASE:-}" && -n "${PGUSER:-}" ]] || {
  echo "ERROR: incomplete DB_* in $PG_ENV_FILE" >&2
  exit 2
}

PSQL="$(find_psql)" || exit 2
export PGPASSWORD

# email_key: lower(trim(email)); blank emails keyed as member:<id>
# Skip incomplete rows (no email and no member_id) — they print as junk
# "Email:,Member ID: ?, NickName:, date:?".
"$PSQL" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -v ON_ERROR_STOP=1 -At -F $'\t' -c "
SELECT
  CASE
    WHEN NULLIF(TRIM(email), '') IS NULL THEN 'member:' || member_id::text
    ELSE lower(TRIM(email))
  END AS email_key,
  COALESCE(TRIM(email), '') AS email,
  COALESCE(member_id::text, '') AS member_id,
  COALESCE(TRIM(alias), '') AS alias,
  to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') AS created_at_iso
FROM ${PGSCHEMA}.singles
WHERE member_id IS NOT NULL
   OR NULLIF(TRIM(email), '') IS NOT NULL
ORDER BY 1, member_id NULLS LAST;
"
