#!/usr/bin/env bash
# Copy repo backup scripts to ~/backups/scripts on the Ubuntu host (run on the box or via deploy-ssh-mac.sh).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-/home/lawsen0/backups/scripts}"

install -d -m 700 "$DEST"
install -m 700 "$REPO_ROOT/scripts/ubuntu-backups/terramaster-enclosure-power.sh" "$DEST/"
install -m 700 "$REPO_ROOT/scripts/ubuntu-backups/backup-postgres.sh" "$DEST/"
install -m 700 "$REPO_ROOT/scripts/ubuntu-backups/backup-nightly.sh" "$DEST/"
echo "Installed to $DEST:"
ls -la "$DEST"/terramaster-enclosure-power.sh "$DEST"/backup-postgres.sh "$DEST"/backup-nightly.sh
