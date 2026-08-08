#!/bin/bash
# Optional daily drift check (minimal ladder step 4).
# Install on Ubuntu, e.g. crontab -e:
#   0 6 * * * /home/lawsen0/code/main/scripts/verify-deploy-cron.sh >> /var/log/vsingles-artifact-verify.log 2>&1
set -euo pipefail
REPO="${VSINGLES_REPO:-$HOME/code/main}"
cd "$REPO"
if ! node scripts/deployIntegrity.mjs verify; then
  echo "$(date -Is) FAIL artifact verify on $(hostname)" >&2
  exit 1
fi
echo "$(date -Is) OK artifact verify on $(hostname)"
