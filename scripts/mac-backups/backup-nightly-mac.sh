#!/usr/bin/env bash
# Mac nightly restic backup (Mac counterpart of scripts/ubuntu-backups/backup-nightly.sh).
# Installed as ~/backups/scripts/backup-nightly.sh by install-mac-backup.sh; run by the
# `backupnightly` alias and the com.tutamall.restic-nightly LaunchAgent (1:00 PM daily).
#
#   backup-nightly.sh ~/backups/.backup-secrets-mac.env [optional snapshot note]
set -euo pipefail

# launchd starts jobs with a minimal PATH (restic in ~/.local/bin, pg_dump/zstd in MacPorts).
export PATH="$HOME/.local/bin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ENV_FILE="${1:-}"
if [[ -z "$ENV_FILE" ]]; then
    echo "Usage: $0 /path/to/.backup-secrets-mac.env [optional snapshot note]"
    exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

NOTE_TAGS=()
if [[ -n "${2:-}" ]]; then NOTE_TAGS=(--tag noted --tag "note:${2//,/;}"); fi

if [[ ! -d "$RESTIC_VOLUME" ]]; then
    echo "[backup:$HOST_TAG] ERROR: backup drive $RESTIC_VOLUME is not mounted — plug it in and rerun backupnightly"
    exit 1
fi

echo "[backup:$HOST_TAG] start $(date)"

mkdir -p "$DUMP_DIR"
dump_file="$DUMP_DIR/vsingles-${HOST_TAG}-$(date +%F-%H%M%S).sql.zst"
echo "[backup:$HOST_TAG] postgres logical: pg_dump -> $dump_file"
pg_dump --no-owner --no-privileges | zstd -q -T0 -19 -o "$dump_file"

# Per-app user counts as tags (Admin Tools → Restic columns); a failed count never blocks the backup.
USER_COUNT_TAGS=()
if counts="$(psql -X -At -F ' ' -c "SELECT (SELECT count(*) FROM outdateddbsnapshotoct2024.singles), (SELECT count(DISTINCT singles_id) FROM outdateddbsnapshotoct2024.notes_vault), (SELECT count(DISTINCT singles_id) FROM outdateddbsnapshotoct2024.photo_albums_vault)" 2>/dev/null)"; then
    read -r users_dates users_notes users_photos <<<"$counts"
    USER_COUNT_TAGS=(--tag "users_dates:$users_dates" --tag "users_notes:$users_notes" --tag "users_photos:$users_photos")
    echo "[backup:$HOST_TAG] users: TutaDates $users_dates, TutaNotes $users_notes, TutaPhoto $users_photos"
fi

echo "[backup:$HOST_TAG] restic backup (photos, large storage, code, postgres dump)"
restic backup "$TUTA_PHOTO_FOLDER" "$LARGE_STORAGE_FOLDER" "$PROJECT_DIR" "$DUMP_DIR" \
    --exclude "$PROJECT_DIR/fe/node_modules/**" \
    --exclude "$PROJECT_DIR/be/node_modules/**" \
    --exclude=".git" \
    --exclude="**/fe/dist/**" \
    --exclude="**/fe/logs/**" \
    --exclude="**/be/logs/**" \
    --exclude="**/EncryptedTutaNotesZip_*.zip" \
    --exclude="**/EncryptedBackup_*.zip" \
    --exclude="**/backup_*.zip" \
    --tag nightly --tag db --tag photos --tag code --tag "$HOST_TAG" ${NOTE_TAGS[@]+"${NOTE_TAGS[@]}"} ${USER_COUNT_TAGS[@]+"${USER_COUNT_TAGS[@]}"}

# Keep every snapshot (several per day too): no restic forget / prune.

echo "[backup:$HOST_TAG] Cleaning up local logical dump directory..."
rm -rf "$DUMP_DIR"

echo "[backup:$HOST_TAG] done $(date)"
