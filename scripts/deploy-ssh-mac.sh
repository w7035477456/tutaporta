#!/usr/bin/env bash
# Mac → Ubuntu hardened SSH (same options as f2 alias).
# Used by deploy-all.sh when DEPLOY_SSH_BIN points here.
#
# Override key/port if needed:
#   DEPLOY_SSH_KEY=/path/to/key DEPLOY_SSH_PORT=59221 scripts/deploy-ssh-mac.sh user@host 'echo ok'

set -euo pipefail

KEY="${DEPLOY_SSH_KEY:-/Volumes/MSWORD2010/.coredump/corruptedKey_march2024}"
PORT="${DEPLOY_SSH_PORT:-59221}"

if [[ ! -r "$KEY" ]]; then
  echo "deploy-ssh-mac: key not readable: $KEY" >&2
  echo "Mount the volume or set DEPLOY_SSH_KEY." >&2
  exit 1
fi

exec sudo ssh \
  -o IdentitiesOnly=yes \
  -i "$KEY" \
  -p "$PORT" \
  "$@"
