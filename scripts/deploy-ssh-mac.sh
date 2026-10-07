#!/usr/bin/env bash
# Mac → Ubuntu hardened SSH (same options as f2 alias).
# Used by deploy-all.sh when DEPLOY_SSH_BIN points here.
#
# Override key/port if needed:
#   DEPLOY_SSH_KEY=/path/to/key DEPLOY_SSH_PORT=59221 scripts/deploy-ssh-mac.sh user@host 'echo ok'
#
# Non-interactive: if ~/.ssh/be/.env (or DEPLOY_SSH_SECRETS) defines
# MAC_SUDO_PASSWORD, the sudo password and key passphrase are answered by
# deploy-ssh-askpass.sh.

set -euo pipefail

KEY="${DEPLOY_SSH_KEY:-/Volumes/MSWORD2010/.coredump/corruptedKey_march2024}"
PORT="${DEPLOY_SSH_PORT:-59221}"
SECRETS="${DEPLOY_SSH_SECRETS:-$HOME/.ssh/be/.env}"
ASKPASS="$(cd "$(dirname "$0")" && pwd)/deploy-ssh-askpass.sh"

if [[ ! -r "$KEY" ]]; then
  echo "deploy-ssh-mac: key not readable: $KEY" >&2
  echo "Mount the volume or set DEPLOY_SSH_KEY." >&2
  exit 1
fi

if [[ -r "$SECRETS" ]] && grep -q '^MAC_SUDO_PASSWORD=' "$SECRETS"; then
  export SUDO_ASKPASS="$ASKPASS"
  exec sudo -A env \
    DEPLOY_SSH_SECRETS="$SECRETS" \
    SSH_ASKPASS="$ASKPASS" \
    SSH_ASKPASS_REQUIRE=force \
    ssh \
    -o IdentitiesOnly=yes \
    -i "$KEY" \
    -p "$PORT" \
    "$@"
fi

exec sudo ssh \
  -o IdentitiesOnly=yes \
  -i "$KEY" \
  -p "$PORT" \
  "$@"
