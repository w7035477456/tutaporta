#!/usr/bin/env bash
# Install root crontab line: every 10 min park the TerraMaster if idle and spun up.
# Usage: sudo set-terramaster-watchdog-cron.sh          # install / refresh
#        sudo set-terramaster-watchdog-cron.sh remove   # uninstall
set -euo pipefail

SCRIPT=/home/lawsen0/backups/scripts/terramaster-idle-watchdog.sh
LOG=/home/lawsen0/backups/terramaster-watchdog.log
MARKER='# terramaster-idle-watchdog (set-terramaster-watchdog-cron.sh)'
newline="*/10 * * * * $SCRIPT >> $LOG 2>&1"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }

tmp="$(mktemp)"
(crontab -l 2>/dev/null || true) | awk '
  /^# terramaster-idle-watchdog/ { next }
  /terramaster-idle-watchdog\.sh/ { next }
  { print }
' > "$tmp"
if [[ "${1:-}" != "remove" ]]; then
  [[ -x "$SCRIPT" ]] || { echo "Missing $SCRIPT" >&2; rm -f "$tmp"; exit 1; }
  printf '%s\n%s\n' "$MARKER" "$newline" >> "$tmp"
fi
crontab "$tmp"
rm -f "$tmp"

crontab -l | grep -A1 terramaster-idle-watchdog || echo "terramaster-idle-watchdog cron removed"
