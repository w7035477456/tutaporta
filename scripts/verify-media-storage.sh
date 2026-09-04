#!/bin/bash
# Verify the Node backend can actually WRITE to its media folders.
#
# A folder owned by another user (this bit us once as www-data on photos/) makes
# every upload fail with EACCES at fs.writeFileSync — the request looks fine all
# the way through validation, then dies on disk. Ownership is checked here rather
# than inferred, because mode bits alone do not tell you if THIS user can write.
#
# Run as the same user PM2 runs as (lawsen0).
# Ubuntu ~/b:  alias checkstorage='$HOME/code/main/scripts/verify-media-storage.sh'
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/media-storage-env.sh
. "${SCRIPT_DIR}/lib/media-storage-env.sh"

ME="$(id -un)"
FAILED=0

# stat flags differ between GNU (Ubuntu) and BSD (Mac dev box).
if stat -c '%U' . >/dev/null 2>&1; then
  stat_owner() { stat -c '%U:%G' "$1"; }
  stat_mode()  { stat -c '%a' "$1"; }
  stat_user()  { stat -c '%U' "$1"; }
else
  stat_owner() { stat -f '%Su:%Sg' "$1"; }
  stat_mode()  { stat -f '%Lp' "$1"; }
  stat_user()  { stat -f '%Su' "$1"; }
fi

check_dir() {
  local key="$1" required="$2"
  local raw dir owner mode probe foreign
  raw="$(read_env "$key")"

  if [[ -z "$raw" ]]; then
    if [[ "$required" == "required" ]]; then
      echo "FAIL  $key is not set in $MEDIA_ENV_FILE"
      FAILED=1
    else
      echo "skip  $key not set (optional)"
    fi
    return
  fi

  dir="$(expand_path "$raw")"

  # uploadPhoto() and ensureMobileUploadFolder() both mkdir -p on first use, so a
  # missing folder is only fatal when the nearest existing parent is unwritable.
  if [[ ! -d "$dir" ]]; then
    local ancestor="$dir"
    while [[ ! -d "$ancestor" && "$ancestor" != "/" ]]; do
      ancestor="$(dirname "$ancestor")"
    done
    probe="$ancestor/.storage_write_test.$$"
    if touch "$probe" 2>/dev/null; then
      rm -f "$probe"
      echo "OK    $key -> $dir"
      echo "      not created yet — backend will mkdir -p on first use ($ancestor is writable)"
    else
      echo "FAIL  $key -> $dir"
      echo "      missing AND cannot be created: $ancestor is not writable by $ME"
      echo "      fix: sudo mkdir -p '$dir' && sudo chown -R $ME:$ME '$dir'"
      FAILED=1
    fi
    return
  fi

  owner="$(stat_owner "$dir")"
  mode="$(stat_mode "$dir")"

  # Definitive test: mode bits and ACLs can disagree, so actually write a file.
  probe="$dir/.storage_write_test.$$"
  if ! touch "$probe" 2>/dev/null; then
    echo "FAIL  $key -> $dir"
    echo "      NOT WRITABLE by $ME  (owner $owner, mode $mode)"
    echo "      fix: sudo chown -R $ME:$ME '$dir' && sudo chmod -R u+rwX '$dir'"
    FAILED=1
    return
  fi
  rm -f "$probe"

  # Files dropped by a sudo/root script keep working for reads but break rewrites.
  foreign=""
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    foreign+="$(stat_user "$entry") $(basename "$entry")"$'\n'
  done < <(find "$dir" -maxdepth 1 ! -user "$ME" 2>/dev/null | grep -v "^$dir$" | head -5)
  foreign="${foreign%$'\n'}"
  if [[ -n "$foreign" ]]; then
    echo "WARN  $key -> $dir"
    echo "      writable, but contains entries owned by another user:"
    echo "$foreign" | sed 's/^/        /'
    echo "      fix: sudo chown -R $ME:$ME '$dir'"
    return
  fi

  echo "OK    $key -> $dir  (owner $owner, mode $mode, writable by $ME)"
}

echo "media storage check — user $ME on $(hostname), env $MEDIA_ENV_FILE"
echo

for entry in "${MEDIA_FOLDER_KEYS[@]}"; do
  # shellcheck disable=SC2086
  check_dir $entry
done

echo
if [[ -n "$FAST_STORAGE_FOLDER" && -d "$FAST_STORAGE_FOLDER" ]]; then
  df -h "$FAST_STORAGE_FOLDER"
  avail_pct="$(df -P "$FAST_STORAGE_FOLDER" | awk 'NR==2 {print $5}' | tr -dc '0-9')"
  if [[ -n "$avail_pct" && "$avail_pct" -ge 90 ]]; then
    echo "WARN  disk ${avail_pct}% full — uploads fail with ENOSPC at 100%"
  fi
fi

echo
if [[ "$FAILED" -ne 0 ]]; then
  echo "RESULT: FAIL — uploads will not work until the above is fixed"
  exit 1
fi
echo "RESULT: OK — backend can write all required media folders"
