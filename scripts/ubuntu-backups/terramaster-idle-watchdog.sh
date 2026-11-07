#!/usr/bin/env bash
# Root cron every 10 min: if the TerraMaster enclosure is spun up and no backup /
# restic work is using it, park it (same as `spinterramaster`).
# Usage: sudo terramaster-idle-watchdog.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POWER="$SCRIPT_DIR/terramaster-enclosure-power.sh"
TERRAMASTER_MOUNT="${TERRAMASTER_MOUNT:-/mnt/terramaster}"
# Touch this file to keep the disk awake for manual work (ignored once older than KEEP_AWAKE_MAX_MIN).
KEEP_AWAKE_FLAG="${TERRAMASTER_KEEP_AWAKE_FLAG:-/run/terramaster-keep-awake}"
KEEP_AWAKE_MAX_MIN="${TERRAMASTER_KEEP_AWAKE_MAX_MIN:-240}"

_log() { echo "[terramaster-watchdog] $(date '+%F %T') $*"; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { _log "must run as root"; exit 1; }
[[ -x "$POWER" ]] || { _log "missing $POWER"; exit 1; }

if pgrep -f 'backup-nightly\.sh|restore-latest\.sh|restore-into-test-db\.sh|setup-terramaster-restic\.sh' >/dev/null; then
  exit 0
fi
if pgrep -x restic >/dev/null; then
  exit 0
fi
if [[ -e "$KEEP_AWAKE_FLAG" ]] && [[ -n "$(find "$KEEP_AWAKE_FLAG" -mmin -"$KEEP_AWAKE_MAX_MIN" 2>/dev/null)" ]]; then
  exit 0
fi
if mountpoint -q "$TERRAMASTER_MOUNT" && fuser -m "$TERRAMASTER_MOUNT" >/dev/null 2>&1; then
  _log "spun up but $TERRAMASTER_MOUNT is in use — skipping"
  exit 0
fi

status="$("$POWER" status 2>/dev/null | sed -n 's/^enclosure status: \([^ (]*\).*/\1/p')"
case "$status" in
  spun_down|offline) exit 0 ;;
  active)
    _log "enclosure active and idle — spinning down"
    "$POWER" sleep
    ;;
  *)
    _log "unknown status '${status}' — not touching it"
    exit 1
    ;;
esac
