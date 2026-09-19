#!/bin/bash
# List singles users that exist on Ubuntu but not Mac (and vice versa).
#
# Uses the same SSH as Mac f2 / isdbsame (port 59221 + corruptedKey_march2024).
#
#   listNewUbuntuUsers
#   listNewUbuntuUsers --verbose
#
# Mac ~/b:
#   alias listNewUbuntuUsers='$HOME/code/main/scripts/list-new-ubuntu-users.sh'
#
# Exit codes: 0 = same (no user diffs), 1 = differences found, 2 = error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/pg-env.sh
. "${SCRIPT_DIR}/lib/pg-env.sh"

UBUNTU_HOST="${COMPARE_SCHEMA_UBUNTU_HOST:-lawsen0@192.168.222.202}"
SSH_BIN="${COMPARE_SCHEMA_SSH_BIN:-${SCRIPT_DIR}/deploy-ssh-mac.sh}"
VERBOSE=0

usage() {
  cat <<'EOF'
list-new-ubuntu-users.sh [--ubuntu-host user@host] [--verbose]

Compares helloworldjunktest.singles on Mac vs Ubuntu (by email).
Prints users that exist on only one side.

SSH defaults (same as f2 / isdbsame): port 59221, IdentitiesOnly, corruptedKey_march2024.
Override: COMPARE_SCHEMA_SSH_BIN, DEPLOY_SSH_KEY, DEPLOY_SSH_PORT (see deploy-ssh-mac.sh).

Environment:
  COMPARE_SCHEMA_UBUNTU_HOST   SSH target (default lawsen0@192.168.222.202)
  COMPARE_SCHEMA_CHECK_VPN     1 = run checkVpn first if available (default 1)
  BE_ENV_FILE                  Mac env file (default ~/.ssh/be/.env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ubuntu-host) UBUNTU_HOST="${2:-}"; shift 2 ;;
    --verbose|-v) VERBOSE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
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

DUMP_SH="${SCRIPT_DIR}/pg-users-dump.sh"
[[ -x "$DUMP_SH" || -f "$DUMP_SH" ]] || fail "missing $DUMP_SH"

pg_load_connection_defaults || fail "cannot read Mac DB env from $PG_ENV_FILE"

TMPDIR="${TMPDIR:-/tmp}"
MAC_DUMP="$(mktemp "${TMPDIR}/pgusers_mac.XXXXXX")"
UBUNTU_DUMP="$(mktemp "${TMPDIR}/pgusers_ubuntu.XXXXXX")"
MAC_CLEAN="$(mktemp "${TMPDIR}/pgusers_mac_clean.XXXXXX")"
UBUNTU_CLEAN="$(mktemp "${TMPDIR}/pgusers_ubuntu_clean.XXXXXX")"
MAC_ERR="$(mktemp "${TMPDIR}/pgusers_mac_err.XXXXXX")"
UBUNTU_ERR="$(mktemp "${TMPDIR}/pgusers_ubuntu_err.XXXXXX")"
ONLY_UBUNTU="$(mktemp "${TMPDIR}/pgusers_only_ubuntu.XXXXXX")"
ONLY_MAC="$(mktemp "${TMPDIR}/pgusers_only_mac.XXXXXX")"
cleanup() {
  rm -f "$MAC_DUMP" "$UBUNTU_DUMP" "$MAC_CLEAN" "$UBUNTU_CLEAN" \
    "$MAC_ERR" "$UBUNTU_ERR" "$ONLY_UBUNTU" "$ONLY_MAC"
}
trap cleanup EXIT

# --- Mac dump ---
if ! bash "$DUMP_SH" >"$MAC_DUMP" 2>"$MAC_ERR"; then
  echo "ERROR: Mac users dump failed ($(pg_connection_label))" >&2
  [[ -s "$MAC_ERR" ]] && cat "$MAC_ERR" >&2
  exit 2
fi

# --- Ubuntu dump via SSH ---
if ! run_ssh \
  'PG_SCHEMA_SCRIPT_DIR=$HOME/code/main/scripts BE_ENV_FILE=$HOME/.ssh/be/.env bash -s' \
  <"$DUMP_SH" >"$UBUNTU_DUMP" 2>"$UBUNTU_ERR"; then
  echo "ERROR: Ubuntu users dump failed via ssh $UBUNTU_HOST (port ${DEPLOY_SSH_PORT:-59221})" >&2
  [[ -s "$UBUNTU_ERR" ]] && cat "$UBUNTU_ERR" >&2
  exit 2
fi

if [[ "$VERBOSE" -eq 1 ]]; then
  echo "--- users compare ---" >&2
  echo "  schema:  $PGSCHEMA" >&2
  echo "  Mac:     $(pg_connection_label)" >&2
  echo "  Ubuntu:  ssh -p ${DEPLOY_SSH_PORT:-59221} $UBUNTU_HOST" >&2
  echo "  Mac rows:    $(wc -l <"$MAC_DUMP" | tr -d ' ')" >&2
  echo "  Ubuntu rows: $(wc -l <"$UBUNTU_DUMP" | tr -d ' ')" >&2
fi

scrub_user_dump() {
  local src="$1"
  local dst="$2"
  # Keep rows with a key and (email or member_id).
  awk -F '\t' 'NF >= 3 && $1 != "" && ($2 != "" || $3 != "") { print }' "$src" >"$dst"
}

scrub_user_dump "$MAC_DUMP" "$MAC_CLEAN"
scrub_user_dump "$UBUNTU_DUMP" "$UBUNTU_CLEAN"

sort -t $'\t' -k1,1 "$MAC_CLEAN" -o "$MAC_CLEAN"
sort -t $'\t' -k1,1 "$UBUNTU_CLEAN" -o "$UBUNTU_CLEAN"

# Only Ubuntu (key in Ubuntu, not Mac)
join -t $'\t' -v 2 -1 1 -2 1 "$MAC_CLEAN" "$UBUNTU_CLEAN" >"$ONLY_UBUNTU" || true
# Only Mac (key in Mac, not Ubuntu)
join -t $'\t' -v 1 -1 1 -2 1 "$MAC_CLEAN" "$UBUNTU_CLEAN" >"$ONLY_MAC" || true

format_member_id() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    echo "?"
    return
  fi
  # Strip non-digits; pad to at least 6 digits (same as formatMemberDisplayCode).
  local digits
  digits="$(printf '%s' "$raw" | tr -cd '0-9')"
  if [[ -z "$digits" ]]; then
    echo "M${raw}"
    return
  fi
  while [[ ${#digits} -lt 6 ]]; do
    digits="0${digits}"
  done
  echo "M${digits}"
}

format_date() {
  # Input: YYYY-MM-DD HH:MM:SS (America/New_York from dump)
  local iso="${1:-}"
  if [[ -z "$iso" ]]; then
    echo "?"
    return
  fi
  local y m d
  y="${iso:0:4}"
  m="${iso:5:2}"
  d="${iso:8:2}"
  local mon
  case "$m" in
    01) mon=Jan ;; 02) mon=Feb ;; 03) mon=Mar ;; 04) mon=Apr ;;
    05) mon=May ;; 06) mon=Jun ;; 07) mon=Jul ;; 08) mon=Aug ;;
    09) mon=Sep ;; 10) mon=Oct ;; 11) mon=Nov ;; 12) mon=Dec ;;
    *) mon="$m" ;;
  esac
  # Example: Jan02, 2026
  printf '%s%s, %s' "$mon" "$d" "$y"
}

print_section() {
  local title="$1"
  local file="$2"
  echo "$title"
  if [[ ! -s "$file" ]]; then
    echo "  (none)"
    return
  fi
  local key email member_id alias created_at printed=0
  while IFS=$'\t' read -r key email member_id alias created_at || [[ -n "${key:-}" ]]; do
    # Skip blank / incomplete rows (was printing Email:,Member ID: ?, …)
    [[ -n "${key:-}" ]] || continue
    [[ -n "${email:-}" || -n "${member_id:-}" ]] || continue
    printf 'Email:%s,Member ID: %s, NickName:%s, date:%s\n' \
      "${email:-}" \
      "$(format_member_id "$member_id")" \
      "${alias:-}" \
      "$(format_date "$created_at")"
    printed=1
  done <"$file"
  if [[ "$printed" -eq 0 ]]; then
    echo "  (none)"
  fi
}

only_ubuntu_n="$(wc -l <"$ONLY_UBUNTU" | tr -d ' ')"
only_mac_n="$(wc -l <"$ONLY_MAC" | tr -d ' ')"

if [[ "$only_ubuntu_n" -eq 0 && "$only_mac_n" -eq 0 ]]; then
  echo "same"
  exit 0
fi

print_section "1) Exist in Ubuntu but not Mac:" "$ONLY_UBUNTU"
echo
print_section "2) Exist in Mac but not Ubuntu:" "$ONLY_MAC"
exit 1
