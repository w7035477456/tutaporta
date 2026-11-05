#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" ]]; then
    echo "Usage: $0 /path/to/.backup-secrets.env [optional snapshot note]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=terramaster-enclosure-power.sh
source "$SCRIPT_DIR/terramaster-enclosure-power.sh"
# shellcheck source=backup-postgres.sh
source "$SCRIPT_DIR/backup-postgres.sh"

source "$ENV_FILE"

NOTE_TAGS=()
if [[ -n "${2:-}" ]]; then NOTE_TAGS=(--tag noted --tag "note:${2//,/;}"); fi

terramaster_wake_and_mount

if ! findmnt -no SOURCE -T "$TERRAMASTER_MOUNT" >/dev/null 2>&1 \
   || [[ "$(findmnt -no SOURCE -T "$TERRAMASTER_MOUNT")" == "$(findmnt -no SOURCE -T /)" ]]; then
    echo "[backup:$HOST_TAG] ERROR: $TERRAMASTER_MOUNT is not a mounted external disk"
    exit 1
fi
if [[ ! -d "$TERRAMASTER_MOUNT" ]]; then
    echo "[backup:$HOST_TAG] ERROR: $TERRAMASTER_MOUNT does not exist"
    exit 1
fi

echo "[backup:$HOST_TAG] start $(date)"
backup_postgres

restic_paths=(
    "$TUTA_PHOTO_FOLDER"
    "$LARGE_STORAGE_FOLDER"
    "$PROJECT_DIR"
)
if [[ ${#POSTGRES_RESTIC_PATHS[@]} -gt 0 ]]; then
    restic_paths+=( "${POSTGRES_RESTIC_PATHS[@]}" )
    echo "[backup:$HOST_TAG] restic backup (photos, large storage, code, postgres artifacts)"
else
    echo "[backup:$HOST_TAG] restic backup (photos, large storage, code — postgres chain on enclosure only)"
fi
restic backup "${restic_paths[@]}" \
    --exclude "$PROJECT_DIR/fe/node_modules/**" \
    --exclude "$PROJECT_DIR/be/node_modules/**" \
    --exclude=".git" \
    --exclude="**/fe/dist/**" \
    --exclude="**/fe/logs/**" \
    --exclude="**/be/logs/**" \
    --exclude="**/EncryptedTutaNotesZip_*.zip" \
    --exclude="**/EncryptedBackup_*.zip" \
    --exclude="**/backup_*.zip" \
    --tag nightly --tag db --tag photos --tag code --tag "$HOST_TAG" "${NOTE_TAGS[@]}"

# Keep every snapshot (several per day too): no restic forget / prune.

if [[ "${POSTGRES_BACKUP_MODE:-logical}" == "logical" ]]; then
    echo "[backup:$HOST_TAG] Cleaning up local logical dump directory..."
    rm -rf "$DUMP_DIR"
fi

echo "[backup:$HOST_TAG] done $(date)"

if ! terramaster_spin_down_and_power_off; then
    echo "[backup:$HOST_TAG] WARNING: enclosure spin-down / power-off failed (backup succeeded)" >&2
fi
