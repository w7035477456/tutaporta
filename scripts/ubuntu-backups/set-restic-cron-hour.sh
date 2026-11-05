#!/usr/bin/env bash
# Install root crontab line for backup-nightly at a fixed hour America/New_York.
# Usage: sudo set-restic-cron-hour.sh 13   # 1:00 PM Eastern (handles DST via dual UTC hours)
set -euo pipefail

H24="${1:-}"
if [[ ! "$H24" =~ ^([0-9]|1[0-9]|2[0-3])$ ]]; then
  echo "Usage: $0 <hour-24 America/New_York, e.g. 13 for 1 PM>" >&2
  exit 2
fi

TZ=America/New_York
SCRIPT=/home/lawsen0/backups/scripts/backup-nightly.sh
ENVF=/home/lawsen0/backups/.backup-secrets-ubuntu.env
LOG=/home/lawsen0/backups/backup-ubuntu.log
MARKER='# restic-nightly (retimed by set-restic-cron-hour.sh)'

utc_a=$(((H24 + 4) % 24))
utc_b=$(((H24 + 5) % 24))
if [[ "$utc_a" -lt "$utc_b" ]]; then hours="$utc_a,$utc_b"; else hours="$utc_b,$utc_a"; fi

newline="0 $hours * * * [ \"\$(TZ=$TZ date +%H)\" = $H24 ] && $SCRIPT $ENVF >> $LOG 2>&1"

crontab_txt="$(crontab -l 2>/dev/null || true)"
tmp="$(mktemp)"
printf '%s\n' "$crontab_txt" | awk -v marker="$MARKER" -v newline="$newline" '
  /^# restic-nightly/ { next }
  /backup-nightly\.sh/ {
    if (!done) { print marker; print newline; done = 1 }
    next
  }
  { print }
  END { if (!done) { print marker; print newline } }
' > "$tmp"
crontab "$tmp"
rm -f "$tmp"

echo "Installed daily backup at $(printf '%02d:00' "$H24") $TZ"
crontab -l | grep -A1 restic-nightly
