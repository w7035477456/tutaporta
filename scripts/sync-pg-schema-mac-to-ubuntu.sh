#!/bin/bash
# Generate SQL that makes the Ubuntu outdateddbsnapshotoct2024 schema match Mac (Mac = source of truth).
# Does NOT change any database: prints the SQL, saves it, copies it to Ubuntu ~/syncdb/, and
# prints the psql command to run on Ubuntu.
#
#   syncdbmacubuntu
#   syncdbmacubuntu --no-push                 # keep the SQL on Mac only
#   syncdbmacubuntu --include-destructive     # also emit DROP TABLE / DROP COLUMN … uncommented
#
# Mac ~/b:
#   alias syncdbmacubuntu='$HOME/code/main/scripts/sync-pg-schema-mac-to-ubuntu.sh'
#
# SSH: same as f2 / isdbsame (deploy-ssh-mac.sh: port 59221, IdentitiesOnly, corruptedKey_march2024).
# Exit codes: 0 = SQL generated (or already same), 2 = error
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UBUNTU_HOST="${COMPARE_SCHEMA_UBUNTU_HOST:-lawsen0@192.168.222.202}"
SSH_BIN="${COMPARE_SCHEMA_SSH_BIN:-${SCRIPT_DIR}/deploy-ssh-mac.sh}"
OUT_DIR="${SYNCDB_OUT_DIR:-$HOME/syncdb}"
PUSH=1
DESTRUCTIVE_FLAG=""

usage() {
  sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-push) PUSH=0; shift ;;
    --include-destructive) DESTRUCTIVE_FLAG="--include-destructive"; shift ;;
    --ubuntu-host) UBUNTU_HOST="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "ERROR: node not found (needed for scripts/pg-schema-diff.mjs)" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/syncdb.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

echo "Comparing Mac vs Ubuntu schema (isdbsame)…" >&2
"${SCRIPT_DIR}/compare-pg-schema.sh" --quiet --ubuntu-host "$UBUNTU_HOST" --save-dumps "$WORK" >"$WORK/verdict" 
rc=$?
verdict="$(head -n1 "$WORK/verdict")"
if [[ $rc -eq 0 && "$verdict" == "same" ]]; then
  echo "same — Ubuntu schema already matches Mac. Nothing to run."
  exit 0
fi
[[ $rc -eq 1 ]] || { echo "ERROR: schema compare failed (exit $rc); run: isdbsame --verbose" >&2; exit 2; }

MAC_RAW="$(ls "$WORK"/mac_*_raw.sql 2>/dev/null | head -1)"
UB_RAW="$(ls "$WORK"/ubuntu_*_raw.sql 2>/dev/null | head -1)"
[[ -s "$MAC_RAW" && -s "$UB_RAW" ]] || { echo "ERROR: raw dumps missing in $WORK" >&2; exit 2; }

mkdir -p "$OUT_DIR"
SQL_NAME="syncdb_mac_to_ubuntu_$(date +%Y%m%d_%H%M%S).sql"
SQL_FILE="$OUT_DIR/$SQL_NAME"
node "${SCRIPT_DIR}/pg-schema-diff.mjs" sync "$MAC_RAW" "$UB_RAW" $DESTRUCTIVE_FLAG >"$SQL_FILE"
gen_rc=$?
if [[ $gen_rc -ne 0 && $gen_rc -ne 3 ]]; then
  echo "ERROR: SQL generation failed (exit $gen_rc)" >&2
  exit 2
fi

cat "$SQL_FILE"
echo
echo "Saved on Mac: $SQL_FILE"

if [[ $gen_rc -eq 3 ]]; then
  echo "No automatic statements could be generated — see the manual-review list above."
  exit 0
fi

REMOTE_FILE="~/syncdb/$SQL_NAME"
if [[ "$PUSH" -eq 1 ]]; then
  if "$SSH_BIN" -o ConnectTimeout=25 "$UBUNTU_HOST" "mkdir -p ~/syncdb && cat > ~/syncdb/$SQL_NAME" <"$SQL_FILE"; then
    echo "Copied to Ubuntu: $UBUNTU_HOST:$REMOTE_FILE"
  else
    echo "WARNING: copy to Ubuntu failed; copy $SQL_FILE there yourself (same port/key as f2)." >&2
  fi
fi

cat <<EOF

######## RUN ON UBUNTU (after f2) ########
# 1) schema backup first
pg_dump -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite --schema-only --schema=outdateddbsnapshotoct2024 -f ~/syncdb/before_${SQL_NAME}
# 2) apply (single transaction; stops on first error)
psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -v ON_ERROR_STOP=1 -f ${REMOTE_FILE}
# 3) back on Mac:  isdbsame
##########################################
EOF
