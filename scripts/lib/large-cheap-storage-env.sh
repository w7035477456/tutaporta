# Shared LARGE_CHEAP_STORAGE_FOLDER (TutaDrive / TutaNotes / TutaPhoto vault) resolution.
# Sourced by fix-large-cheap-storage.sh and verify-large-cheap-storage.sh.

LARGE_CHEAP_ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"

large_cheap_env_require_readable() {
  if [[ ! -r "$LARGE_CHEAP_ENV_FILE" ]]; then
    echo "FAIL  cannot read env file: $LARGE_CHEAP_ENV_FILE" >&2
    exit 1
  fi
}

read_large_cheap_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$LARGE_CHEAP_ENV_FILE" \
    | tail -n1 \
    | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

large_cheap_env_require_readable
FAST_STORAGE_FOLDER="$(read_large_cheap_env FAST_STORAGE_FOLDER)"
LARGE_CHEAP_STORAGE_FOLDER="$(read_large_cheap_env LARGE_CHEAP_STORAGE_FOLDER)"

# Mirror be/loadEnv.js / tutaDriveMemberPaths.js — cheap root falls back to FAST_STORAGE_FOLDER.
expand_large_cheap_path() {
  local v="$1"
  v="${v//\$\{FAST_STORAGE_FOLDER\}/$FAST_STORAGE_FOLDER}"
  v="${v//\$FAST_STORAGE_FOLDER/$FAST_STORAGE_FOLDER}"
  v="${v//\$\{HOME\}/$HOME}"
  v="${v//\$HOME/$HOME}"
  [[ "$v" == "~/"* ]] && v="$HOME/${v:2}"
  echo "${v%/}"
}

resolve_large_cheap_root() {
  local raw="${LARGE_CHEAP_STORAGE_FOLDER:-}"
  if [[ -z "$raw" ]]; then
    raw="${FAST_STORAGE_FOLDER:-}"
  fi
  expand_large_cheap_path "$raw"
}
