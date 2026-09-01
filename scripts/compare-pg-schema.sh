#!/bin/bash
# Compare helloworldjunktest schema: Mac (~/.ssh/be/.env) vs Ubuntu (SSH + remote .env).
#
# Prints exactly one line: "same" or "difference"
#
# Uses the same SSH as Mac f2 alias (port 59221 + corruptedKey_march2024 via deploy-ssh-mac.sh).
#
#   comparepgschema
#   comparepgschema --verbose
#
# Mac ~/b:
#   alias comparepgschema='$HOME/code/main/scripts/compare-pg-schema.sh'
#
# Exit codes: 0 = same, 1 = difference, 2 = error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/pg-env.sh
. "${SCRIPT_DIR}/lib/pg-env.sh"

UBUNTU_HOST="${COMPARE_SCHEMA_UBUNTU_HOST:-lawsen0@192.168.222.202}"
SSH_BIN="${COMPARE_SCHEMA_SSH_BIN:-${SCRIPT_DIR}/deploy-ssh-mac.sh}"
VERBOSE=0
SAVE_DUMPS=""

usage() {
  cat <<'EOF'
compare-pg-schema.sh [--ubuntu-host user@host] [--verbose] [--save-dumps dir]

Compares PostgreSQL schema (default: helloworldjunktest) on Mac vs Ubuntu.
Output: "same" or "difference" (one line).

SSH defaults (same as f2 alias): port 59221, IdentitiesOnly, corruptedKey_march2024.
Override: COMPARE_SCHEMA_SSH_BIN, DEPLOY_SSH_KEY, DEPLOY_SSH_PORT (see deploy-ssh-mac.sh).

Environment:
  COMPARE_SCHEMA_UBUNTU_HOST   SSH target (default lawsen0@192.168.222.202)
  COMPARE_SCHEMA_CHECK_VPN     1 = run checkVpn first if available (default 1, like f2)
  BE_ENV_FILE                  Mac env file (default ~/.ssh/be/.env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ubuntu-host) UBUNTU_HOST="${2:-}"; shift 2 ;;
    --verbose|-v) VERBOSE=1; shift ;;
    --save-dumps) SAVE_DUMPS="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; echo "difference"; exit 2 ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
  echo "difference"
  exit 2
}

maybe_check_vpn() {
  [[ "${COMPARE_SCHEMA_CHECK_VPN:-1}" == "1" ]] || return 0
  if declare -f checkVpn >/dev/null 2>&1; then
    checkVpn
    return $?
  fi
  if command -v checkVpn >/dev/null 2>&1; then
    checkVpn
    return $?
  fi
  return 0
}

run_ssh() {
  maybe_check_vpn || fail "VPN check failed (source ~/b and ensure VPN is up, same as f2)"
  [[ -x "$SSH_BIN" || -f "$SSH_BIN" ]] || fail "SSH helper missing: $SSH_BIN"
  "$SSH_BIN" -o ConnectTimeout=25 "$UBUNTU_HOST" "$@"
}

[[ -n "$UBUNTU_HOST" ]] || fail "--ubuntu-host required (or COMPARE_SCHEMA_UBUNTU_HOST)"

DUMP_SH="${SCRIPT_DIR}/pg-schema-dump.sh"
[[ -x "$DUMP_SH" || -f "$DUMP_SH" ]] || fail "missing $DUMP_SH"

pg_load_connection_defaults || fail "cannot read Mac DB env from $PG_ENV_FILE"
SCHEMA="$PGSCHEMA"

TMPDIR="${TMPDIR:-/tmp}"
MAC_DUMP="$(mktemp "${TMPDIR}/pgschema_mac.XXXXXX")"
UBUNTU_DUMP="$(mktemp "${TMPDIR}/pgschema_ubuntu.XXXXXX")"
MAC_ERR="$(mktemp "${TMPDIR}/pgschema_mac_err.XXXXXX")"
UBUNTU_ERR="$(mktemp "${TMPDIR}/pgschema_ubuntu_err.XXXXXX")"
cleanup() { rm -f "$MAC_DUMP" "$UBUNTU_DUMP" "$MAC_ERR" "$UBUNTU_ERR"; }
trap cleanup EXIT

# --- Mac dump ---
if ! bash "$DUMP_SH" >"$MAC_DUMP" 2>"$MAC_ERR"; then
  echo "ERROR: Mac pg_dump failed ($(pg_connection_label))" >&2
  [[ -s "$MAC_ERR" ]] && cat "$MAC_ERR" >&2
  echo "difference"
  exit 2
fi
[[ -s "$MAC_DUMP" ]] || fail "Mac schema dump empty (schema $SCHEMA missing on Mac?)"

# --- Ubuntu dump via SSH (same path as f2: port 59221 + key) ---
if ! run_ssh \
  'PG_SCHEMA_SCRIPT_DIR=$HOME/code/main/scripts BE_ENV_FILE=$HOME/.ssh/be/.env bash -s' \
  <"$DUMP_SH" >"$UBUNTU_DUMP" 2>"$UBUNTU_ERR"; then
  echo "ERROR: Ubuntu dump failed via ssh $UBUNTU_HOST (port ${DEPLOY_SSH_PORT:-59221})" >&2
  [[ -s "$UBUNTU_ERR" ]] && cat "$UBUNTU_ERR" >&2
  if [[ "$VERBOSE" -eq 1 ]]; then
    echo "--- ssh probe ---" >&2
    run_ssh \
      "hostname; command -v pg_dump; ls /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | head -1; grep -E '^DB_(HOST|PORT|NAME|USER)=' ~/.ssh/be/.env | head -4" \
      2>&1 >&2 || true
  fi
  echo "difference"
  exit 2
fi
[[ -s "$UBUNTU_DUMP" ]] || {
  echo "ERROR: Ubuntu schema dump empty (schema $SCHEMA missing on Ubuntu?)" >&2
  [[ -s "$UBUNTU_ERR" ]] && cat "$UBUNTU_ERR" >&2
  echo "difference"
  exit 2
}

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
  echo "--- Ubuntu: ssh -p ${DEPLOY_SSH_PORT:-59221} $UBUNTU_HOST ---" >&2
  diff -u "$MAC_DUMP" "$UBUNTU_DUMP" | head -120 >&2 || true
  echo "Mac lines: $(wc -l <"$MAC_DUMP" | tr -d ' ')  Ubuntu lines: $(wc -l <"$UBUNTU_DUMP" | tr -d ' ')" >&2
fi
exit 1
