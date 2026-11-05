#!/usr/bin/env bash
# Run a command on Ubuntu xbox2 as root via sudo, without interactive tty.
#
#   scripts/ubuntu-sudo.sh bash ~/backups/scripts/apply-terramaster-default-offline.sh
#   scripts/ubuntu-sudo.sh ~/backups/scripts/terramaster-enclosure-power.sh wake
#
# Password: UBUNTU_SUDO_PASSWORD in ~/.ssh/be/.env (Mac, outside git). Sent as the first
# line of SSH stdin and read into sudo -S remotely — never in argv or tool output.
#
# Overrides: UBUNTU_SSH_HOST, DEPLOY_SSH_SECRETS (~/.ssh/be/.env).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS="${DEPLOY_SSH_SECRETS:-$HOME/.ssh/be/.env}"
SSH_HOST="${UBUNTU_SSH_HOST:-lawsen0@192.168.222.202}"

if [[ $# -lt 1 ]]; then
  sed -n '2,10p' "$0" >&2
  exit 2
fi

[[ -r "$SECRETS" ]] || { echo "ubuntu-sudo: secrets file not readable: $SECRETS" >&2; exit 2; }
password="$(sed -n 's/^UBUNTU_SUDO_PASSWORD=//p' "$SECRETS" | tail -n 1 | tr -d '\r')"
password="${password%\"}"; password="${password#\"}"
password="${password%\'}"; password="${password#\'}"
[[ -n "$password" ]] || {
  echo "ubuntu-sudo: UBUNTU_SUDO_PASSWORD missing in $SECRETS (add it with vi — do not paste in chat)" >&2
  exit 2
}

remote_cmd=$(printf '%q ' "$@")
remote_cmd="${remote_cmd% }"

remote='IFS= read -r _ubuntu_sudo_pass
printf "%s\n" "$_ubuntu_sudo_pass" | sudo -S -p "" bash -lc '"$(printf '%q' "$remote_cmd")"''

{ printf '%s\n' "$password"; } |
  "$SCRIPT_DIR/deploy-ssh-mac.sh" -o ConnectTimeout=25 "$SSH_HOST" "$remote"
