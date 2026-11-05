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

source "$ENV_FILE"

NOTE_TAGS=()
if [[ -n "${2:-}" ]]; then NOTE_TAGS=(--tag noted --tag "note:${2//,/;}"); fi

terramaster_wake_and_mount

# fail fast if the external TerraMaster enclosure is not really mounted
if ! findmnt -no SOURCE -T "$TERRAMASTER_MOUNT" >/dev/null 2>&1 \
   || [[ "$(findmnt -no SOURCE -T "$TERRAMASTER_MOUNT")" == "$(findmnt -no SOURCE -T /)" ]]; then
    echo "[backup:$HOST_TAG] ERROR: $TERRAMASTER_MOUNT is not a mounted external disk"
    exit 1
fi
if [[ ! -d "$TERRAMASTER_MOUNT" ]]; then
    echo "[backup:$HOST_TAG] ERROR: $TERRAMASTER_MOUNT does not exist"
    exit 1
fi

mkdir -p "$DUMP_DIR"
TS="$(date +%F-%H%M%S)"
DUMP_FILE="$DUMP_DIR/vsingles-${HOST_TAG}-${TS}.sql.zst"

echo "[backup:$HOST_TAG] start $(date)"
echo "[backup:$HOST_TAG] pg_dump -> $DUMP_FILE"
pg_dump --no-owner --no-privileges | zstd -T0 -19 -o "$DUMP_FILE"

echo "[backup:$HOST_TAG] restic backup"
restic backup \
    "$TUTA_PHOTO_FOLDER" \
    "$LARGE_STORAGE_FOLDER" \
    "$DUMP_DIR" \
    "$PROJECT_DIR" \
    --exclude "$PROJECT_DIR/fe/node_modules/**" \
    --exclude "$PROJECT_DIR/be/node_modules/**" \
    --exclude=".git" \
    --exclude="**/fe/dist/**" \
    --exclude="**/be/logs/**" \
    --exclude="**/EncryptedTutaNotesZip_*.zip" \
    --exclude="**/EncryptedBackup_*.zip" \
    --exclude="**/backup_*.zip" \
    --tag nightly --tag db --tag photos --tag code --tag "$HOST_TAG" "${NOTE_TAGS[@]}"

# Keep every snapshot (several per day too): no restic forget / prune.

echo "[backup:$HOST_TAG] Cleaning up local dump directory..."
rm -rf "$DUMP_DIR"

echo "[backup:$HOST_TAG] done $(date)"

if ! terramaster_spin_down_and_power_off; then
    echo "[backup:$HOST_TAG] WARNING: enclosure spin-down / power-off failed (backup succeeded)" >&2
fi
