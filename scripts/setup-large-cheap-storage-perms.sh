#!/usr/bin/env bash
# Align LARGE_CHEAP_STORAGE_FOLDER permissions with STORAGE_FOLDER so the
# Node app (TutaNotes / TutaDrive) can CRUD …/users/M{id}/notes|photos.
#
# Usage (Mac or Ubuntu, after sourcing env or with paths set):
#   bash scripts/setup-large-cheap-storage-perms.sh
# Or:
#   STORAGE_FOLDER=… LARGE_CHEAP_STORAGE_FOLDER=… bash scripts/setup-large-cheap-storage-perms.sh

set -euo pipefail

ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # Expand ${STORAGE_FOLDER} etc. lightly
  # shellcheck disable=SC1091
  source <(grep -E '^(STORAGE_FOLDER|LARGE_CHEAP_STORAGE_FOLDER)=' "$ENV_FILE" | sed 's/\r$//')
  set +a
fi

STORAGE_FOLDER="${STORAGE_FOLDER:-}"
LARGE_CHEAP_STORAGE_FOLDER="${LARGE_CHEAP_STORAGE_FOLDER:-}"

if [[ -z "$LARGE_CHEAP_STORAGE_FOLDER" ]]; then
  echo "LARGE_CHEAP_STORAGE_FOLDER is not set (check $ENV_FILE)" >&2
  exit 1
fi

if [[ -z "$STORAGE_FOLDER" ]]; then
  echo "STORAGE_FOLDER is not set; cannot copy ownership reference" >&2
  exit 1
fi

if [[ ! -d "$STORAGE_FOLDER" ]]; then
  echo "STORAGE_FOLDER does not exist: $STORAGE_FOLDER" >&2
  exit 1
fi

echo "STORAGE_FOLDER=$STORAGE_FOLDER"
echo "LARGE_CHEAP_STORAGE_FOLDER=$LARGE_CHEAP_STORAGE_FOLDER"

# Owner/group from STORAGE_FOLDER (same app user that already can CRUD there)
OWNER="$(stat -c '%U' "$STORAGE_FOLDER" 2>/dev/null || stat -f '%Su' "$STORAGE_FOLDER")"
GROUP="$(stat -c '%G' "$STORAGE_FOLDER" 2>/dev/null || stat -f '%Sg' "$STORAGE_FOLDER")"
MODE="$(stat -c '%a' "$STORAGE_FOLDER" 2>/dev/null || stat -f '%OLp' "$STORAGE_FOLDER")"

echo "Reference owner:mode = ${OWNER}:${GROUP} mode ${MODE}"

mkdir -p "$LARGE_CHEAP_STORAGE_FOLDER/users"

if [[ "$(id -un)" == "root" ]] || [[ "$(id -un)" == "$OWNER" ]]; then
  chown "$OWNER:$GROUP" "$LARGE_CHEAP_STORAGE_FOLDER" || true
  chown -R "$OWNER:$GROUP" "$LARGE_CHEAP_STORAGE_FOLDER/users" || true
else
  echo "Note: not owner/root — skipping chown (run as $OWNER or with sudo if needed)"
fi

chmod "$MODE" "$LARGE_CHEAP_STORAGE_FOLDER"
chmod 755 "$LARGE_CHEAP_STORAGE_FOLDER/users"
# Member dirs: owner rwx, group/other rx (same style as STORAGE photos/)
find "$LARGE_CHEAP_STORAGE_FOLDER/users" -type d -exec chmod 755 {} \;
find "$LARGE_CHEAP_STORAGE_FOLDER/users" -type f -exec chmod 644 {} \; 2>/dev/null || true

PROBE="$LARGE_CHEAP_STORAGE_FOLDER/users/.perm_probe_$$"
mkdir -p "$PROBE/notes" "$PROBE/photos"
echo ok >"$PROBE/notes/w.txt"
rm -rf "$PROBE"
echo "Write probe under users/: OK"

ls -lad "$STORAGE_FOLDER" "$LARGE_CHEAP_STORAGE_FOLDER" "$LARGE_CHEAP_STORAGE_FOLDER/users"
echo "Done."
