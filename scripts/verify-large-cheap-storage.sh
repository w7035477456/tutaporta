#!/bin/bash
# Verify the Node backend can WRITE to LARGE_CHEAP_STORAGE_FOLDER (TutaDrive vault).
#
# Run as the same user PM2 runs as (lawsen0).
#
#   checklargecheap
#   checklargecheap --member-id 237112    # deep check one member vault tree
#
# Ubuntu ~/b:
#   alias checklargecheap='$HOME/code/main/scripts/verify-large-cheap-storage.sh'
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/large-cheap-storage-env.sh
. "${SCRIPT_DIR}/lib/large-cheap-storage-env.sh"

ME="$(id -un)"
MEMBER_ID=""
FAILED=0

usage() {
  cat <<'EOF'
verify-large-cheap-storage.sh [--member-id N]
  --member-id N   Also probe users/M{N}/notes, photos, TutaNotes vault paths
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --member-id) MEMBER_ID="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if stat -c '%U' . >/dev/null 2>&1; then
  stat_owner() { stat -c '%U:%G' "$1"; }
  stat_mode()  { stat -c '%a' "$1"; }
  stat_user()  { stat -c '%U' "$1"; }
  has_namei=1
else
  stat_owner() { stat -f '%Su:%Sg' "$1"; }
  stat_mode()  { stat -f '%Lp' "$1"; }
  stat_user()  { stat -f '%Su' "$1"; }
  has_namei=0
fi

ROOT="$(resolve_large_cheap_root)"

echo "large-cheap storage check — user $ME on $(hostname)"
echo "env $LARGE_CHEAP_ENV_FILE"
echo "LARGE_CHEAP root -> ${ROOT:-(not set)}"
echo

if [[ -z "$ROOT" ]]; then
  echo "FAIL  LARGE_CHEAP_STORAGE_FOLDER and FAST_STORAGE_FOLDER are not set"
  exit 1
fi

check_writable_dir() {
  local label="$1" dir="$2"
  local owner mode probe

  if [[ ! -d "$dir" ]]; then
    local ancestor="$dir"
    while [[ ! -d "$ancestor" && "$ancestor" != "/" ]]; do
      ancestor="$(dirname "$ancestor")"
    done
    probe="$ancestor/.large_cheap_write_test.$$"
    if touch "$probe" 2>/dev/null; then
      rm -f "$probe"
      echo "OK    $label -> $dir"
      echo "      not created yet — backend will mkdir -p ($ancestor writable)"
      return
    fi
    echo "FAIL  $label -> $dir"
    echo "      missing AND parent not writable by $ME"
    FAILED=1
    return
  fi

  owner="$(stat_owner "$dir")"
  mode="$(stat_mode "$dir")"
  probe="$dir/.large_cheap_write_test.$$"
  if ! touch "$probe" 2>/dev/null; then
    echo "FAIL  $label -> $dir"
    echo "      NOT WRITABLE by $ME (owner $owner, mode $mode)"
    echo "      fix: fixlargecheap   # or: bash ~/code/main/scripts/fix-large-cheap-storage.sh"
    FAILED=1
    return
  fi
  rm -f "$probe"
  echo "OK    $label -> $dir  (owner $owner, mode $mode, writable by $ME)"
}

list_dir() {
  local path="$1"
  if [[ -e "$path" ]]; then
    ls -lad "$path" 2>/dev/null || true
  else
    echo "(missing) $path"
  fi
}

echo "--- who runs node ---"
ps -u "$ME" -o user,pid,cmd 2>/dev/null | grep -E '[n]ode|[P]M2' | head -5 || echo "(no node process for $ME)"
echo

echo "--- root paths ---"
list_dir "$ROOT"
list_dir "$ROOT/users"
echo

check_writable_dir "LARGE_CHEAP root" "$ROOT"
check_writable_dir "users/" "$ROOT/users"

if [[ -n "$MEMBER_ID" ]]; then
  MEMBER="$ROOT/users/M${MEMBER_ID}"
  NOTES="$MEMBER/notes"
  PHOTOS="$MEMBER/photos"
  VAULT="$NOTES/TutaNotes"
  echo
  echo "--- member M${MEMBER_ID} ---"
  list_dir "$MEMBER"
  list_dir "$NOTES"
  list_dir "$PHOTOS"
  list_dir "$VAULT"
  list_dir "$VAULT/files"
  list_dir "$VAULT/photos"
  echo
  check_writable_dir "member notes" "$NOTES"
  check_writable_dir "member photos" "$PHOTOS"
  check_writable_dir "TutaNotes vault" "$VAULT"

  if [[ "$has_namei" -eq 1 && -e "$VAULT/vault.db" ]]; then
    echo
    echo "--- path walk (namei) vault.db ---"
    namei -l "$VAULT/vault.db" 2>/dev/null || true
  fi

  echo
  echo "--- write probe as $ME in TutaNotes vault ---"
  if [[ -d "$VAULT" ]]; then
    if sudo -u "$ME" bash -lc "touch '$VAULT/.perm_probe' && echo WRITE_OK && rm -f '$VAULT/.perm_probe'" 2>/dev/null; then
      echo "WRITE_OK"
    else
      echo "WRITE_DENIED"
      FAILED=1
    fi
  fi
fi

echo
echo "--- foreign ownership (not $ME) under users/ ---"
if [[ -d "$ROOT/users" ]]; then
  foreign="$(find "$ROOT/users" \( -type d -o -type f \) ! -user "$ME" 2>/dev/null | head -20)"
  if [[ -n "$foreign" ]]; then
    echo "$foreign" | while IFS= read -r entry; do
      [[ -z "$entry" ]] && continue
      echo "  $(stat_owner "$entry")  $entry"
    done
    echo "  fix: fixlargecheap"
  else
    echo "  (none in first 20 entries)"
  fi
else
  echo "  skip — users/ missing"
fi

echo
echo "--- wrong modes (dirs not 755, files not 644) under users/ ---"
if [[ -d "$ROOT/users" ]]; then
  bad="$(find "$ROOT/users" \( -type d ! -perm 755 \) -o \( -type f ! -perm 644 \) 2>/dev/null | head -20)"
  if [[ -n "$bad" ]]; then
    echo "$bad" | sed 's/^/  /'
    echo "  (informational — fixlargecheap normalizes modes)"
  else
    echo "  (none in first 20 entries)"
  fi
fi

echo
if [[ -d "$ROOT" ]]; then
  df -h "$ROOT" 2>/dev/null || true
fi

echo
if [[ "$FAILED" -ne 0 ]]; then
  echo "RESULT: FAIL — TutaDrive / vault writes will fail until fixed"
  echo "  fix: bash ~/code/main/scripts/fix-large-cheap-storage.sh"
  exit 1
fi
echo "RESULT: OK — backend can write LARGE_CHEAP storage"
[[ -z "$MEMBER_ID" ]] && echo "  tip: checklargecheap --member-id YOUR_ID for deep vault probe"
