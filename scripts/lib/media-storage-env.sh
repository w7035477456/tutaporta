# Shared media-folder resolution. Sourced by verify-media-storage.sh and
# fix-media-storage.sh — not executed directly.
#
# The key list and the ${VAR} expansion live here so "check" and "fix" can never
# disagree about which directories the backend actually writes to. If they drifted,
# fixstorage would repair one set of folders while checkstorage validated another.

MEDIA_ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"

# "<env key> <required|optional>" — every folder the Node backend writes to.
MEDIA_FOLDER_KEYS=(
  "VSINGLES_PHOTO_FOLDER required"
  "UPLOAD_FOLDER required"
  "STORAGE_FOLDER optional"
  "LARGE_CHEAP_STORAGE_FOLDER optional"
  "VSINGLES_VIDEO_FOLDER optional"
  "RECORD_NOTES_ONEDRIVE_STAGING_ROOT optional"
)

media_env_require_readable() {
  if [[ ! -r "$MEDIA_ENV_FILE" ]]; then
    echo "FAIL  cannot read env file: $MEDIA_ENV_FILE" >&2
    exit 1
  fi
}

# Last assignment wins, strip inline comments / quotes / trailing space.
read_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$MEDIA_ENV_FILE" \
    | tail -n1 \
    | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

media_env_require_readable
STORAGE_FOLDER="$(read_env STORAGE_FOLDER)"
ROOT_FOLDER="$(read_env ROOT_FOLDER)"

# Mirror be/loadEnv.js ${VAR} expansion for the few vars paths actually use.
expand_path() {
  local v="$1"
  v="${v//\$\{STORAGE_FOLDER\}/$STORAGE_FOLDER}"
  v="${v//\$STORAGE_FOLDER/$STORAGE_FOLDER}"
  v="${v//\$\{ROOT_FOLDER\}/$ROOT_FOLDER}"
  v="${v//\$\{HOME\}/$HOME}"
  v="${v//\$HOME/$HOME}"
  [[ "$v" == "~/"* ]] && v="$HOME/${v:2}"
  echo "${v%/}"
}
