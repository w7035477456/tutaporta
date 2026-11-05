#!/usr/bin/env bash
# One-shot: soft-park policy, boot service, wake/spin self-test on xbox2 (via ubuntu-sudo.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUDO="$ROOT/scripts/ubuntu-sudo.sh"

echo "== Install backup scripts to ~/backups/scripts =="
scp -o IdentitiesOnly=yes -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}" -P "${DEPLOY_SSH_PORT:-59221}" \
  "$ROOT/scripts/ubuntu-backups/backup-nightly.sh" \
  "$ROOT/scripts/ubuntu-backups/backup-postgres.sh" \
  "$ROOT/scripts/ubuntu-backups/terramaster-enclosure-power.sh" \
  "$ROOT/scripts/ubuntu-backups/apply-terramaster-default-offline.sh" \
  lawsen0@192.168.222.202:~/backups/scripts/
bash "$ROOT/scripts/deploy-ssh-mac.sh" lawsen0@192.168.222.202 \
  'chmod 700 ~/backups/scripts/backup-nightly.sh ~/backups/scripts/terramaster-enclosure-power.sh ~/backups/scripts/apply-terramaster-default-offline.sh'

echo "== apply-terramaster-default-offline (fstab noauto + boot soft-park unit) =="
"$SUDO" bash ~/backups/scripts/apply-terramaster-default-offline.sh

echo "== Cron line (root) =="
"$SUDO" crontab -l 2>/dev/null | grep -F backup-nightly || echo "(no backup-nightly in root crontab — run resticcron on box)"

echo "== Wake / mount self-test =="
"$SUDO" bash ~/backups/scripts/terramaster-enclosure-power.sh wake
bash "$ROOT/scripts/deploy-ssh-mac.sh" lawsen0@192.168.222.202 'findmnt /mnt/terramaster; lsblk -o NAME,SIZE,MOUNTPOINT | grep sd'

echo "== Soft spin-down self-test =="
"$SUDO" bash ~/backups/scripts/terramaster-enclosure-power.sh sleep
bash "$ROOT/scripts/deploy-ssh-mac.sh" lawsen0@192.168.222.202 \
  'lsblk -o NAME,SIZE,MOUNTPOINT | grep sd; test -b /dev/sdb && echo "sdb still present (good for auto-wake)" || echo "WARNING: sdb missing"'

echo "== Done. Nightly cron uses backup-nightly.sh (wake → backup → soft park). =="
