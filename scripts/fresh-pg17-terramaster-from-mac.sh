#!/usr/bin/env bash
# From Mac (VPN on): PG 17 on xbox2, wipe TerraMaster, fresh restic + first pg_basebackup full + restic + 1 PM cron.
#
#   scripts/fresh-pg17-terramaster-from-mac.sh
#   scripts/fresh-pg17-terramaster-from-mac.sh --skip-pg-upgrade   # enclosure + backup only
#   scripts/fresh-pg17-terramaster-from-mac.sh --skip-format       # keep existing ext4 data
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$ROOT/scripts/deploy-ssh-mac.sh"
SUDO="$ROOT/scripts/ubuntu-sudo.sh"
HOST="${UBUNTU_SSH_HOST:-lawsen0@192.168.222.202}"

SKIP_PG=0
SKIP_FORMAT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pg-upgrade) SKIP_PG=1; shift ;;
    --skip-format) SKIP_FORMAT=1; shift ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

echo "== Sync backup scripts =="
"$SSH" "$HOST" 'mkdir -p ~/backups/scripts ~/code/main/scripts/ubuntu-backups'
scp -o IdentitiesOnly=yes -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}" -P "${DEPLOY_SSH_PORT:-59221}" \
  "$ROOT/scripts/ubuntu-backups/"*.sh \
  "$HOST:~/backups/scripts/"
"$SSH" "$HOST" 'chmod 700 ~/backups/scripts/*.sh'

if [[ "$SKIP_PG" -eq 0 ]]; then
  echo "== Postgres 16 -> 17 on Ubuntu =="
  scp -o IdentitiesOnly=yes -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}" -P "${DEPLOY_SSH_PORT:-59221}" \
    "$ROOT/scripts/pg17-upgrade-ubuntu-primary.sh" "$HOST:/tmp/pg17-upgrade-ubuntu-primary.sh"
  "$SUDO" bash /tmp/pg17-upgrade-ubuntu-primary.sh
fi

echo "== TerraMaster: fresh volume + restic init + pg-basebackup dir =="
SETUP_ARGS=(--disk /dev/sdb --yes --no-migrate)
[[ "$SKIP_FORMAT" -eq 1 ]] || SETUP_ARGS=(--format "${SETUP_ARGS[@]}")
scp -o IdentitiesOnly=yes -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}" -P "${DEPLOY_SSH_PORT:-59221}" \
  "$ROOT/scripts/setup-terramaster-restic.sh" "$HOST:/tmp/setup-terramaster-restic.sh"
"$SUDO" bash /tmp/setup-terramaster-restic.sh "${SETUP_ARGS[@]}"

echo "== Default offline + cron 1 PM Eastern =="
"$SUDO" bash /home/lawsen0/backups/scripts/apply-terramaster-default-offline.sh 2>/dev/null || \
  "$SUDO" bash "$ROOT/scripts/ubuntu-backups/apply-terramaster-default-offline.sh" || true
scp -o IdentitiesOnly=yes -i "${DEPLOY_SSH_KEY:-$HOME/.ssh/xbox2.pem}" -P "${DEPLOY_SSH_PORT:-59221}" \
  "$ROOT/scripts/ubuntu-backups/set-restic-cron-hour.sh" "$HOST:/tmp/set-restic-cron-hour.sh"
"$SUDO" bash /tmp/set-restic-cron-hour.sh 13

echo "== First nightly: full pg_basebackup + restic baseline =="
"$SUDO" env POSTGRES_BASE_FORCE_FULL=1 bash /home/lawsen0/backups/scripts/backup-nightly.sh \
  /home/lawsen0/backups/.backup-secrets-ubuntu.env "pg17-fresh-baseline"

echo "== Verify =="
"$SSH" "$HOST" 'pg_lsclusters -h; pg_basebackup --version; sudo crontab -l | grep -A1 restic-nightly; ls -la /mnt/terramaster/'
"$SUDO" bash -c 'source /home/lawsen0/backups/.backup-secrets-ubuntu.env; restic snapshots --latest 3'

echo "== Mac: run locally when ready: scripts/pg17-upgrade-mac.sh =="
echo "Done."
