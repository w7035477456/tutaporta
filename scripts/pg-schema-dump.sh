#!/bin/bash
# Dump one Postgres schema to stdout (schema-only, normalized for compare).
# Run on Mac or Ubuntu; reads ~/.ssh/be/.env (or BE_ENV_FILE).
#
#   bash scripts/pg-schema-dump.sh > /tmp/schema.sql
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
  pg_connection_label() {
    echo "${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE} schema=${PGSCHEMA}"
  }
fi

pg_load_connection_defaults || exit 2

find_pg_dump() {
  if command -v pg_dump >/dev/null 2>&1; then
    command -v pg_dump
    return 0
  fi
  local candidate
  for candidate in /usr/lib/postgresql/*/bin/pg_dump /usr/local/bin/pg_dump /opt/homebrew/bin/pg_dump; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  echo "ERROR: pg_dump not found on $(hostname)" >&2
  return 1
}

normalize_schema_dump() {
  sed -E \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\./d' \
    -e '/^\\restrict/d' \
    -e '/^\\unrestrict/d' \
    -e 's/[[:space:]]+$//' \
    | awk 'NF { print }'
}

[[ -n "${PGHOST:-}" && -n "${PGPORT:-}" && -n "${PGDATABASE:-}" && -n "${PGUSER:-}" ]] || {
  echo "ERROR: incomplete DB_* in $PG_ENV_FILE" >&2
  exit 2
}

PG_DUMP="$(find_pg_dump)" || exit 2
export PGPASSWORD

err_file="$(mktemp "${TMPDIR:-/tmp}/pgschema_dump_err.XXXXXX")"
out_file="$(mktemp "${TMPDIR:-/tmp}/pgschema_dump_out.XXXXXX")"
trap 'rm -f "$err_file" "$out_file"' EXIT

if ! "$PG_DUMP" \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --schema="$PGSCHEMA" \
  >"$out_file" \
  2>"$err_file"; then
  echo "ERROR: pg_dump failed for $(pg_connection_label)" >&2
  [[ -s "$err_file" ]] && cat "$err_file" >&2
  exit 1
fi

if [[ ! -s "$out_file" ]]; then
  echo "ERROR: pg_dump returned empty output for schema $PGSCHEMA ($(pg_connection_label))" >&2
  [[ -s "$err_file" ]] && cat "$err_file" >&2
  exit 1
fi

normalize_schema_dump <"$out_file"
