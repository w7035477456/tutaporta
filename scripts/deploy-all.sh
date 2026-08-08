#!/usr/bin/env bash
set -euo pipefail

# Deploy branch to hosts in deploy-hosts.txt (work2-style on each Ubuntu host).
#
#   scripts/deploy-all.sh --hosts-file scripts/deploy-hosts.txt --target mybranch
#
# Mac → Ubuntu: use deployall2 in ~/b (sudo ssh -t + custom key/port).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE_SCRIPT="${SCRIPT_DIR}/remote-deploy-work2.sh"

HOSTS_FILE=""
HOSTS_INLINE=""
TARGET=""
SSH_OPTS="${DEPLOY_SSH_OPTS:--t -o ConnectTimeout=15}"
SSH_USE_SUDO="${DEPLOY_SSH_USE_SUDO:-0}"
SSH_BIN="${DEPLOY_SSH_BIN:-}"
DRY_RUN=0
CONTINUE_ON_ERROR=0

usage() {
  cat <<'EOF'
deploy-all.sh --target <branch> [--hosts-file path | --hosts "h1 h2"]
  --ssh-use-sudo    Use sudo ssh (Mac deployall2)
  --ssh-opts "..."  Default includes -t (TTY for Ubuntu git key passphrase, same as work2)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hosts-file) HOSTS_FILE="${2:-}"; shift 2 ;;
    --hosts) HOSTS_INLINE="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --ssh-opts) SSH_OPTS="${2:-}"; shift 2 ;;
    --ssh-bin) SSH_BIN="${2:-}"; shift 2 ;;
    --ssh-use-sudo) SSH_USE_SUDO=1; shift ;;
    --continue-on-error) CONTINUE_ON_ERROR=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -n "$TARGET" ]] || { echo "Missing --target." >&2; usage; exit 2; }
[[ -f "$REMOTE_SCRIPT" ]] || { echo "Missing $REMOTE_SCRIPT" >&2; exit 1; }

if [[ -z "$HOSTS_FILE" && -z "$HOSTS_INLINE" ]]; then
  HOSTS_FILE="${ROOT_DIR}/scripts/deploy-hosts.txt"
fi

declare -a HOSTS
if [[ -n "$HOSTS_INLINE" ]]; then
  read -r -a HOSTS <<< "$HOSTS_INLINE"
elif [[ -f "$HOSTS_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | awk '{$1=$1;print}')"
    [[ -z "$line" ]] && continue
    HOSTS+=("$line")
  done < "$HOSTS_FILE"
else
  echo "No hosts file: $HOSTS_FILE" >&2
  exit 2
fi

[[ ${#HOSTS[@]} -gt 0 ]] || { echo "No hosts." >&2; exit 2; }

echo "Deploy target : $TARGET"
echo "Hosts count   : ${#HOSTS[@]}"
echo

is_local_host() {
  local host="$1" h="${host#*@}" h="${h%%:*}"
  case "$h" in localhost|127.0.0.1|::1) return 0 ;; esac
  local n
  for n in $(hostname -s 2>/dev/null) $(hostname 2>/dev/null) $(hostname -I 2>/dev/null); do
    [[ "$h" == "$n" ]] && return 0
  done
  return 1
}

run_ssh() {
  local host="$1"
  shift
  if [[ -n "$SSH_BIN" ]]; then
    "$SSH_BIN" "$host" "$@"
  elif [[ "$SSH_USE_SUDO" == "1" ]]; then
    # shellcheck disable=SC2086
    sudo ssh $SSH_OPTS "$host" "$@"
  else
    # shellcheck disable=SC2086
    ssh $SSH_OPTS "$host" "$@"
  fi
}

deploy_local() {
  BRANCH="$TARGET" bash --noprofile --norc "$REMOTE_SCRIPT"
}

deploy_remote() {
  local host="$1"
  local qbranch
  qbranch="$(printf '%q' "$TARGET")"
  run_ssh "$host" "BRANCH=${qbranch} REPO=\$HOME/code/main bash --noprofile --norc \$HOME/code/main/scripts/remote-deploy-work2.sh"
}

declare -a OK_HOSTS=() FAIL_HOSTS=()

for host in "${HOSTS[@]}"; do
  echo "===== [$host] deploy start ====="
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "target=$TARGET host=$host local=$(is_local_host "$host" && echo yes || echo no)"
    OK_HOSTS+=("$host")
    continue
  fi
  if is_local_host "$host"; then
    echo "(local)"
    if deploy_local; then OK_HOSTS+=("$host"); else FAIL_HOSTS+=("$host"); fi
  else
    if deploy_remote "$host"; then OK_HOSTS+=("$host"); else FAIL_HOSTS+=("$host"); fi
  fi
  if [[ ${#FAIL_HOSTS[@]} -gt 0 && "$CONTINUE_ON_ERROR" -ne 1 ]]; then
    break
  fi
  echo
done

echo "========== Deploy Summary =========="
echo "Succeeded (${#OK_HOSTS[@]}): ${OK_HOSTS[*]:-none}"
echo "Failed    (${#FAIL_HOSTS[@]}): ${FAIL_HOSTS[*]:-none}"
[[ ${#FAIL_HOSTS[@]} -eq 0 ]]
