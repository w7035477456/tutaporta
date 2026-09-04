#!/bin/bash
# Repair ownership and permissions on LARGE_CHEAP_STORAGE_FOLDER (TutaDrive vault:
# …/users/M{id}/notes, …/photos, TutaNotes, TutaPhotoAlbums). Then verify.
#
# Same failure mode as photos/: folder owned by www-data/root after sudo deploy →
# EACCES on TutaNotes / TutaPhoto / record vault writes.
#
#   fixlargecheap                 # this host
#   fixlargecheap --dry-run       # print commands only
#   fixlargecheap --all-hosts     # every host in scripts/deploy-hosts.txt
#
# Ubuntu ~/b:
#   alias fixlargecheap='$HOME/code/main/scripts/fix-large-cheap-storage.sh'
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DRY_RUN=0
ALL_HOSTS=0
HOSTS_FILE="${ROOT_DIR}/scripts/deploy-hosts.txt"
NO_RESTART=0

usage() {
  cat <<'EOF'
fix-large-cheap-storage.sh [--dry-run] [--all-hosts] [--hosts-file path] [--no-restart]
  --dry-run      Print chown/chmod commands without running them
  --all-hosts    Repair every host in scripts/deploy-hosts.txt
  --no-restart   Skip "pm2 restart onlinemallwebsite"
Target user defaults to $SUDO_USER when run under sudo, else the current user.
Override with STORAGE_APP_USER=name.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --all-hosts) ALL_HOSTS=1; shift ;;
    --hosts-file) HOSTS_FILE="${2:-}"; shift 2 ;;
    --no-restart) NO_RESTART=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ "$ALL_HOSTS" -eq 1 ]]; then
  [[ -f "$HOSTS_FILE" ]] || { echo "No hosts file: $HOSTS_FILE" >&2; exit 2; }
  declare -a HOSTS=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | awk '{$1=$1;print}')"
    [[ -z "$line" ]] && continue
    HOSTS+=("$line")
  done < "$HOSTS_FILE"
  [[ ${#HOSTS[@]} -gt 0 ]] || { echo "No hosts in $HOSTS_FILE" >&2; exit 2; }

  declare -a OK_HOSTS=() FAIL_HOSTS=()
  FORWARD=""
  [[ "$DRY_RUN" -eq 1 ]] && FORWARD="$FORWARD --dry-run"
  [[ "$NO_RESTART" -eq 1 ]] && FORWARD="$FORWARD --no-restart"

  for host in "${HOSTS[@]}"; do
    echo "===== [$host] fix large-cheap storage ====="
    case "${host#*@}" in
      localhost|127.0.0.1|::1)
        # shellcheck disable=SC2086
        if bash "$0" $FORWARD; then OK_HOSTS+=("$host"); else FAIL_HOSTS+=("$host"); fi
        ;;
      *)
        if ssh -o ConnectTimeout=15 "$host" \
             "bash \$HOME/code/main/scripts/fix-large-cheap-storage.sh${FORWARD}"; then
          OK_HOSTS+=("$host")
        else
          FAIL_HOSTS+=("$host")
        fi
        ;;
    esac
    echo
  done

  echo "========== fixlargecheap summary =========="
  echo "Repaired (${#OK_HOSTS[@]}): ${OK_HOSTS[*]:-none}"
  echo "Failed   (${#FAIL_HOSTS[@]}): ${FAIL_HOSTS[*]:-none}"
  [[ ${#FAIL_HOSTS[@]} -eq 0 ]]
  exit $?
fi

# shellcheck source=lib/large-cheap-storage-env.sh
. "${SCRIPT_DIR}/lib/large-cheap-storage-env.sh"

APP_USER="${STORAGE_APP_USER:-${SUDO_USER:-$(id -un)}}"
APP_GROUP="$(id -gn "$APP_USER" 2>/dev/null || echo "$APP_USER")"
HOST="$(hostname)"
ROOT="$(resolve_large_cheap_root)"

if [[ "$APP_USER" == "root" ]]; then
  echo "REFUSING: target user resolved to root." >&2
  echo "Run as the PM2 user, or set STORAGE_APP_USER=lawsen0." >&2
  exit 2
fi

if [[ -z "$ROOT" || "$ROOT" == "/" ]]; then
  echo "REFUSING: LARGE_CHEAP_STORAGE_FOLDER (or FAST_STORAGE_FOLDER fallback) is empty or /." >&2
  echo "Set LARGE_CHEAP_STORAGE_FOLDER in $LARGE_CHEAP_ENV_FILE" >&2
  exit 2
fi

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  DRY-RUN  $*"
    return 0
  fi
  echo "  + $*"
  "$@"
}

echo "fix large-cheap storage — host $HOST, user $APP_USER:$APP_GROUP"
echo "LARGE_CHEAP root -> $ROOT"
echo "env file: $LARGE_CHEAP_ENV_FILE"
[[ "$DRY_RUN" -eq 1 ]] && echo "(dry run — nothing will change)"
echo

FAILED=0

if [[ ! -d "$ROOT" ]]; then
  run sudo mkdir -p "$ROOT" || FAILED=1
fi
run sudo mkdir -p "$ROOT/users" || FAILED=1
run sudo chown -R "$APP_USER:$APP_GROUP" "$ROOT" || FAILED=1
run sudo chmod -R u+rwX "$ROOT" || FAILED=1

# Normalize dirs 755 / files 644 (matches legacy fix_storage_and_restart in ~/b).
if [[ "$DRY_RUN" -eq 0 ]]; then
  run sudo find "$ROOT" -type d -exec chmod 755 {} + || FAILED=1
  run sudo find "$ROOT" -type f -exec chmod 644 {} + 2>/dev/null || true
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "RESULT: FAIL — could not repair $ROOT"
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "RESULT: dry run complete — rerun without --dry-run to apply"
  exit 0
fi

if [[ "$NO_RESTART" -eq 0 ]]; then
  echo "restarting backend…"
  run pm2 restart onlinemallwebsite || echo "  (pm2 restart failed — restart manually)"
  echo
fi

echo "verifying…"
echo
exec "${SCRIPT_DIR}/verify-large-cheap-storage.sh"
