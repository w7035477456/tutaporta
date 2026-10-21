#!/usr/bin/env bash
# Mac → Ubuntu hardened SSH (same options as f2 alias / ~/.ssh/config Host xbox2).
# Used by deploy-all.sh when DEPLOY_SSH_BIN points here.
#
# Override key/port if needed:
#   DEPLOY_SSH_KEY=/path/to/key DEPLOY_SSH_PORT=59221 scripts/deploy-ssh-mac.sh user@host 'echo ok'
#
# Non-interactive: if ~/.ssh/be/.env (or DEPLOY_SSH_SECRETS) defines
# SSH_KEY_PASSPHRASE, the key passphrase is answered by deploy-ssh-askpass.sh.

set -euo pipefail

KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}"
PORT="${DEPLOY_SSH_PORT:-59221}"
SECRETS="${DEPLOY_SSH_SECRETS:-$HOME/.ssh/be/.env}"
ASKPASS="$(cd "$(dirname "$0")" && pwd)/deploy-ssh-askpass.sh"

if [[ ! -r "$KEY" ]]; then
  echo "deploy-ssh-mac: key not readable: $KEY" >&2
  echo "Copy the xbox2 private key to ~/.ssh/xbox2.pem (chmod 600) or set DEPLOY_SSH_KEY." >&2
  exit 1
fi

if [[ -r "$SECRETS" ]] && grep -q '^SSH_KEY_PASSPHRASE=' "$SECRETS"; then
  export DEPLOY_SSH_SECRETS="$SECRETS"
  export SSH_ASKPASS="$ASKPASS"
  export SSH_ASKPASS_REQUIRE=force
fi

exec ssh \
  -o IdentitiesOnly=yes \
  -i "$KEY" \
  -p "$PORT" \
  "$@"
