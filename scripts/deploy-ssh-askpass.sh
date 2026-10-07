#!/usr/bin/env bash
# SUDO_ASKPASS / SSH_ASKPASS helper for deploy-ssh-mac.sh.
# Prints the Mac sudo password or the SSH key passphrase (MAC_SUDO_PASSWORD /
# SSH_KEY_PASSPHRASE) from ~/.ssh/be/.env — never commit it.

set -euo pipefail

SECRETS="${DEPLOY_SSH_SECRETS:-$HOME/.ssh/be/.env}"

case "${1:-}" in
  *assphrase*) key=SSH_KEY_PASSPHRASE ;;
  *) key=MAC_SUDO_PASSWORD ;;
esac

sed -n "s/^${key}=//p" "$SECRETS" | tail -n 1
