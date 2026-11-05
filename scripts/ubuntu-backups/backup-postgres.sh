#!/usr/bin/env bash
# Postgres backup leg for nightly restic (sourced or run standalone with env file).
#
# POSTGRES_BACKUP_MODE (from .backup-secrets-ubuntu.env):
#   logical          — default; pg_dump | zstd (PG 16+). Restore via RestoreSnapshot / psql.
#   pg17-incremental — PG 17+ only: pg_basebackup full + --incremental chain (NOT pg_dump).
#                      Requires summarize_wal=on. Restic backs up PG_BASEBACKUP_ROOT.
#
# At 50k users, plan: upgrade cluster to PG 17+, set POSTGRES_BACKUP_MODE=pg17-incremental,
# run a scheduled full (e.g. weekly) via POSTGRES_BASE_FORCE_FULL=1 backupnightly.
set -euo pipefail

backup_postgres_logical() {
    local ts dump_file
    mkdir -p "$DUMP_DIR"
    ts="$(date +%F-%H%M%S)"
    dump_file="$DUMP_DIR/vsingles-${HOST_TAG}-${ts}.sql.zst"
    echo "[backup:$HOST_TAG] postgres logical: pg_dump -> $dump_file"
    pg_dump --no-owner --no-privileges | zstd -T0 -19 -o "$dump_file"
    POSTGRES_RESTIC_PATHS=( "$DUMP_DIR" )
}

backup_postgres_pg17_incremental() {
    local ver major base_root ts dest manifest parent
    ver="$(pg_basebackup --version 2>/dev/null | sed -n 's/.* \([0-9][0-9]*\).*/\1/p')"
    major="${ver:-0}"
    if [[ "$major" -lt 17 ]]; then
        echo "[backup:$HOST_TAG] WARNING: pg17-incremental needs PG 17+ pg_basebackup (have ${ver:-unknown}); falling back to logical dump" >&2
        backup_postgres_logical
        return 0
    fi

    base_root="${PG_BASEBACKUP_ROOT:-/mnt/terramaster/pg-basebackup}"
    mkdir -p "$base_root"
    ts="$(date +%F-%H%M%S)"

    manifest=""
    if [[ "${POSTGRES_BASE_FORCE_FULL:-0}" != "1" ]]; then
        manifest="$(find "$base_root" -name backup_manifest -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2- || true)"
    fi

    if [[ -n "$manifest" && -f "$manifest" ]]; then
        dest="$base_root/incr-${ts}"
        echo "[backup:$HOST_TAG] postgres pg17: incremental pg_basebackup -> $dest (from $manifest)"
        pg_basebackup -D "$dest" -Fp -Xs -P --incremental="$manifest"
    else
        dest="$base_root/full-${ts}"
        echo "[backup:$HOST_TAG] postgres pg17: full pg_basebackup -> $dest"
        pg_basebackup -D "$dest" -Fp -Xs -P
    fi

    # Chain is stored on the enclosure; restic covers folders only (see backup-nightly.sh).
    if [[ "${POSTGRES_INCLUDE_IN_RESTIC:-0}" == "1" ]]; then
        POSTGRES_RESTIC_PATHS=( "$base_root" )
    else
        POSTGRES_RESTIC_PATHS=()
    fi
}

backup_postgres() {
    POSTGRES_RESTIC_PATHS=()
    case "${POSTGRES_BACKUP_MODE:-logical}" in
        logical) backup_postgres_logical ;;
        pg17-incremental) backup_postgres_pg17_incremental ;;
        *)
            echo "[backup:$HOST_TAG] ERROR: unknown POSTGRES_BACKUP_MODE=${POSTGRES_BACKUP_MODE}" >&2
            exit 1
            ;;
    esac
}
