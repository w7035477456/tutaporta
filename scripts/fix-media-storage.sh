#!/bin/bash
# Repair ownership and permissions on the backend media folders, then verify.
#
# Fixes the failure mode where a folder ends up owned by another user (www-data,
# root) because a deploy or maintenance script ran under sudo. Reads and writes
# still look fine to `ls`, but the Node process gets EACCES and every upload dies.
#
# Cluster: web servers are round-robin with NO sticky sessions, so one bad host
# breaks roughly 1 in N uploads and looks intermittent. --all-hosts repairs every
# host in scripts/deploy-hosts.txt so you are not chasing a moving target.
#
#   fixstorage                 # this host
#   fixstorage --dry-run       # show commands, change nothing
#   fixstorage --all-hosts     # every host in deploy-hosts.txt
#
# Ubuntu ~/b:  alias fixstorage='$HOME/code/main/scripts/fix-media-storage.sh'
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DRY_RUN=0
ALL_HOSTS=0
HOSTS_FILE="${ROOT_DIR}/scripts/deploy-hosts.txt"
NO_RESTART=0

usage() {
  cat <<'EOF'
fix-media-storage.sh [--dry-run] [--all-hosts] [--hosts-file path] [--no-restart]
  --dry-run      Print the chown/chmod commands without running them
  --all-hosts    Repair every host in scripts/deploy-hosts.txt (round-robin cluster)
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

# ---------------------------------------------------------------- all hosts --
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
    echo "===== [$host] fix media storage ====="
    case "${host#*@}" in
      localhost|127.0.0.1|::1)
        # shellcheck disable=SC2086
        if bash "$0" $FORWARD; then OK_HOSTS+=("$host"); else FAIL_HOSTS+=("$host"); fi
        ;;
      *)
        if ssh -o ConnectTimeout=15 "$host" \
             "bash \$HOME/code/main/scripts/fix-media-storage.sh${FORWARD}"; then
          OK_HOSTS+=("$host")
        else
          FAIL_HOSTS+=("$host")
        fi
        ;;
    esac
    echo
  done

  echo "========== fixstorage summary =========="
  echo "Repaired (${#OK_HOSTS[@]}): ${OK_HOSTS[*]:-none}"
  echo "Failed   (${#FAIL_HOSTS[@]}): ${FAIL_HOSTS[*]:-none}"
  [[ ${#FAIL_HOSTS[@]} -eq 0 ]]
  exit $?
fi

# -------------------------------------------------------------- single host --
# shellcheck source=lib/media-storage-env.sh
. "${SCRIPT_DIR}/lib/media-storage-env.sh"

# Under sudo, id -un is root — chowning to root would recreate the exact bug
# this script exists to fix, so prefer the invoking user.
APP_USER="${STORAGE_APP_USER:-${SUDO_USER:-$(id -un)}}"
APP_GROUP="$(id -gn "$APP_USER" 2>/dev/null || echo "$APP_USER")"
HOST="$(hostname)"

if [[ "$APP_USER" == "root" ]]; then
  echo "REFUSING: target user resolved to root." >&2
  echo "Run as the PM2 user, or set STORAGE_APP_USER=lawsen0." >&2
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

echo "fix media storage — host $HOST, target user $APP_USER:$APP_GROUP, env $MEDIA_ENV_FILE"
[[ "$DRY_RUN" -eq 1 ]] && echo "(dry run — nothing will change)"
echo

CHANGED=0
FAILED=0

for entry in "${MEDIA_FOLDER_KEYS[@]}"; do
  key="${entry%% *}"
  required="${entry##* }"
  raw="$(read_env "$key")"

  if [[ -z "$raw" ]]; then
    if [[ "$required" == "required" ]]; then
      echo "FAIL  $key is not set in $MEDIA_ENV_FILE"
      FAILED=1
    else
      echo "skip  $key not set (optional)"
    fi
    continue
  fi

  dir="$(expand_path "$raw")"
  echo "$key -> $dir"

  if [[ ! -d "$dir" ]]; then
    run sudo mkdir -p "$dir" || FAILED=1
  fi
  run sudo chown -R "$APP_USER:$APP_GROUP" "$dir" || FAILED=1
  run sudo chmod -R u+rwX "$dir" || FAILED=1
  CHANGED=1
  echo
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "RESULT: FAIL — could not repair every folder (see errors above)"
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "RESULT: dry run complete — rerun without --dry-run to apply"
  exit 0
fi

if [[ "$CHANGED" -eq 1 && "$NO_RESTART" -eq 0 ]]; then
  echo "restarting backend so it picks up the repaired folders"
  run pm2 restart onlinemallwebsite || echo "  (pm2 restart failed — restart manually)"
  echo
fi

echo "verifying…"
echo
exec "${SCRIPT_DIR}/verify-media-storage.sh"
