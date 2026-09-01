#!/bin/bash
# Compare helloworldjunktest schema: Mac (~/.ssh/be/.env) vs Ubuntu (SSH + remote .env).
#
# Prints exactly one line: "same" or "difference"
#
#   comparepgschema                          # Mac vs default Ubuntu host
#   comparepgschema --ubuntu-host u@host     # Mac vs custom host
#   comparepgschema --verbose                # show diff summary on mismatch
#   comparepgschema --save-dumps /tmp/schema-dumps
#
# Ubuntu ~/b:
#   alias comparepgschema='$HOME/code/main/scripts/compare-pg-schema.sh'
#
# Exit codes: 0 = same, 1 = difference, 2 = error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/pg-env.sh
. "${SCRIPT_DIR}/lib/pg-env.sh"

UBUNTU_HOST="${COMPARE_SCHEMA_UBUNTU_HOST:-lawsen0@192.168.222.202}"
VERBOSE=0
SAVE_DUMPS=""
REMOTE_ENV_FILE='~/.ssh/be/.env'

usage() {
  cat <<'EOF'
compare-pg-schema.sh [--ubuntu-host user@host] [--remote-env path] [--verbose] [--save-dumps dir]

Compares PostgreSQL schema (default: helloworldjunktest) on Mac vs Ubuntu.
Output: "same" or "difference" (one line).

Environment:
  COMPARE_SCHEMA_UBUNTU_HOST   default SSH target (lawsen0@192.168.222.202)
  BE_ENV_FILE                  Mac env file (default ~/.ssh/be/.env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ubuntu-host) UBUNTU_HOST="${2:-}"; shift 2 ;;
    --remote-env) REMOTE_ENV_FILE="${2:-}"; shift 2 ;;
    --verbose|-v) VERBOSE=1; shift ;;
    --save-dumps) SAVE_DUMPS="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$UBUNTU_HOST" ]]; then
  echo "ERROR: --ubuntu-host is required (or set COMPARE_SCHEMA_UBUNTU_HOST)" >&2
  echo "difference"
  exit 2
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found on Mac PATH" >&2
  echo "difference"
  exit 2
fi

dump_schema_local() {
  local out="$1"
  pg_load_connection_defaults || return 1
  [[ -n "${PGHOST:-}" && -n "${PGPORT:-}" && -n "${PGDATABASE:-}" && -n "${PGUSER:-}" ]] || {
    echo "ERROR: incomplete DB_* vars in $PG_ENV_FILE" >&2
    return 1
  }
  export PGPASSWORD
  pg_dump \
    -h "$PGHOST" \
    -p "$PGPORT" \
    -U "$PGUSER" \
    -d "$PGDATABASE" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --no-comments \
    --schema="$PGSCHEMA" \
    2>/dev/null \
    | normalize_schema_dump >"$out"
}

dump_schema_remote() {
  local out="$1"
  local raw
  raw="$(mktemp "${TMPDIR:-/tmp}/pgschema_remote_raw.XXXXXX")"
  if ! ssh -o ConnectTimeout=20 "$UBUNTU_HOST" "bash -s" -- "$REMOTE_ENV_FILE" "$PGSCHEMA" >"$raw" 2>/dev/null <<'REMOTE'; then
set -uo pipefail
REMOTE_ENV="$1"
SCHEMA="$2"
ENV_FILE="${REMOTE_ENV/#\~/$HOME}"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "ERROR: cannot read $ENV_FILE on $(hostname)" >&2
  exit 2
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found on $(hostname)" >&2
  exit 2
fi
read_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
    | tail -n1 \
    | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}
PGHOST="$(read_env DB_HOST)"
PGPORT="$(read_env DB_PORT)"
PGDATABASE="$(read_env DB_NAME)"
PGUSER="$(read_env DB_USER)"
PGPASSWORD="$(read_env DB_PASSWORD)"
export PGPASSWORD
pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --schema="$SCHEMA" \
  2>/dev/null
REMOTE
    rm -f "$raw"
    return 1
  fi
  if grep -q '^ERROR:' "$raw" 2>/dev/null; then
    cat "$raw" >&2
    rm -f "$raw"
    return 1
  fi
  normalize_schema_dump <"$raw" >"$out"
  rm -f "$raw"
}

normalize_schema_dump() {
  # Drop noise that differs between hosts/pg_dump versions but not real DDL.
  sed -E \
    -e '/^--/d' \
    -e '/^SET /d' \
    -e '/^SELECT pg_catalog\./d' \
    -e '/^\\restrict/d' \
    -e '/^\\unrestrict/d' \
    -e 's/[[:space:]]+$//' \
    | awk 'NF { print }'
}

TMPDIR="${TMPDIR:-/tmp}"
MAC_DUMP="$(mktemp "${TMPDIR}/pgschema_mac.XXXXXX")"
UBUNTU_DUMP="$(mktemp "${TMPDIR}/pgschema_ubuntu.XXXXXX")"
cleanup() { rm -f "$MAC_DUMP" "$UBUNTU_DUMP"; }
trap cleanup EXIT

pg_load_connection_defaults || {
  echo "difference"
  exit 2
}
SCHEMA="$PGSCHEMA"

if ! dump_schema_local "$MAC_DUMP"; then
  echo "difference"
  echo "ERROR: Mac pg_dump failed ($(pg_connection_label))" >&2
  exit 2
fi

if ! dump_schema_remote "$UBUNTU_DUMP"; then
  echo "difference"
  echo "ERROR: Ubuntu pg_dump failed via ssh $UBUNTU_HOST" >&2
  exit 2
fi

if [[ ! -s "$MAC_DUMP" ]]; then
  echo "difference"
  echo "ERROR: Mac schema dump is empty (schema $SCHEMA missing?)" >&2
  exit 2
fi

if [[ ! -s "$UBUNTU_DUMP" ]]; then
  echo "difference"
  echo "ERROR: Ubuntu schema dump is empty (schema $SCHEMA missing?)" >&2
  exit 2
fi

if [[ -n "$SAVE_DUMPS" ]]; then
  mkdir -p "$SAVE_DUMPS"
  cp "$MAC_DUMP" "$SAVE_DUMPS/mac_${SCHEMA}.sql"
  cp "$UBUNTU_DUMP" "$SAVE_DUMPS/ubuntu_${SCHEMA}.sql"
fi

if cmp -s "$MAC_DUMP" "$UBUNTU_DUMP"; then
  echo "same"
  exit 0
fi

echo "difference"
if [[ "$VERBOSE" -eq 1 ]]; then
  echo "--- Mac: $(pg_connection_label) ---" >&2
  echo "--- Ubuntu: ssh $UBUNTU_HOST ---" >&2
  diff -u "$MAC_DUMP" "$UBUNTU_DUMP" | head -120 >&2 || true
  mac_lines="$(wc -l <"$MAC_DUMP" | tr -d ' ')"
  ubuntu_lines="$(wc -l <"$UBUNTU_DUMP" | tr -d ' ')"
  echo "Mac lines: $mac_lines  Ubuntu lines: $ubuntu_lines" >&2
fi
exit 1
