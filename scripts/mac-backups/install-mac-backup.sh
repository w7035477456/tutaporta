#!/usr/bin/env bash
# One-time / re-runnable Mac restic setup (no sudo):
#   - ~/backups/scripts/backup-nightly.sh   (what the `backupnightly` alias runs)
#   - ~/backups/.backup-secrets-mac.env     (created once with a random RESTIC_PASSWORD; never overwritten)
#   - restic repo on the external drive     (restic init if missing)
#   - LaunchAgent com.tutamall.restic-nightly → daily at HOUR:00 local time (default 13)
#   - ~/backups/restic-cron.line            (schedule shown in Admin Tools → Restic)
#
#   scripts/mac-backups/install-mac-backup.sh [hour-24]
set -euo pipefail

export PATH="$HOME/.local/bin:/opt/local/bin:$PATH"
H24="${1:-13}"
[[ "$H24" =~ ^([0-9]|1[0-9]|2[0-3])$ ]] || { echo "Usage: $0 [hour-24, e.g. 13]" >&2; exit 2; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUPS="$HOME/backups"
SCRIPT="$BACKUPS/scripts/backup-nightly.sh"
ENVF="$BACKUPS/.backup-secrets-mac.env"
LOG="$BACKUPS/backup-mac.log"
LABEL=com.tutamall.restic-nightly
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
VOLUME="${RESTIC_VOLUME:-/Volumes/1T_CLIP}"

command -v restic >/dev/null || { echo "restic not found in ~/.local/bin or PATH" >&2; exit 1; }

mkdir -p "$BACKUPS/scripts" "$HOME/Library/LaunchAgents"
chmod 700 "$BACKUPS"
install -m 700 "$ROOT/scripts/mac-backups/backup-nightly-mac.sh" "$SCRIPT"

if [[ ! -f "$ENVF" ]]; then
  umask 077
  {
    echo "export RESTIC_VOLUME=$VOLUME"
    echo "export RESTIC_REPOSITORY=$VOLUME/restic-mac"
    echo "export RESTIC_PASSWORD='$(openssl rand -base64 33 | tr -d '\n')'"
    echo "export PGHOST=127.0.0.1"
    echo "export PGPORT=50010"
    echo "export PGDATABASE=outdatedDBOct2021"
    echo "export PGUSER=test_user1"
    echo "export DUMP_DIR=$BACKUPS/pg-dump-tmp"
    echo "export TUTA_PHOTO_FOLDER=$HOME/mac_storage/tutamallStorageFolder_outdatedOct2021"
    echo "export LARGE_STORAGE_FOLDER=$HOME/mac_storage/tutamallStorageFolder_largecheapstorage_outdatedOct2021"
    echo "export PROJECT_DIR=$HOME/code/main"
    echo "export HOST_TAG=mac"
  } > "$ENVF"
  chmod 600 "$ENVF"
  echo "Created $ENVF (random RESTIC_PASSWORD — keep a copy somewhere safe; without it the backups cannot be read)"
fi

# shellcheck source=/dev/null
source "$ENVF"
if [[ ! -d "$RESTIC_VOLUME" ]]; then
  echo "Backup drive $RESTIC_VOLUME is not mounted — plug it in and rerun." >&2
  exit 1
fi
if ! restic cat config >/dev/null 2>&1; then
  echo "Initializing restic repo $RESTIC_REPOSITORY"
  restic init
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
    <string>$ENVF</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$H24</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

# Same line format as the Ubuntu root crontab so the BE can parse it; on the Mac launchd runs it
# at HOUR:00 America/New_York (the two UTC hours cover EDT and EST).
utc_a=$(((H24 + 4) % 24)); utc_b=$(((H24 + 5) % 24))
if [[ "$utc_a" -lt "$utc_b" ]]; then hours="$utc_a,$utc_b"; else hours="$utc_b,$utc_a"; fi
printf '0 %s * * * [ "$(TZ=America/New_York date +\\%%H)" = %02d ] && %s %s >> %s 2>&1\n' \
  "$hours" "$H24" "$SCRIPT" "$ENVF" "$LOG" > "$BACKUPS/restic-cron.line"

echo "Installed: backupnightly -> $SCRIPT"
echo "LaunchAgent $LABEL: daily at $(printf '%02d:00' "$H24") local time, log $LOG"
