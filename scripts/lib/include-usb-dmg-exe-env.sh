#!/usr/bin/env bash
# Shared helper: ~/.ssh/be/.env INCLUDE_USB_DMG_EXE (default true when unset).

load_be_env_keys() {
  local env_file="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"
  [[ -f "$env_file" ]] || return 0
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line%"${line##*[![:space:]]}"}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%%#*}"
    val="$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    case "$key" in
      INCLUDE_USB_DMG_EXE|STORAGE_FOLDER|USB_DMG_EXE)
        if [[ -z "${!key:-}" ]]; then
          printf -v "$key" '%s' "$val"
          export "$key"
        fi
        ;;
    esac
  done <"$env_file"
}

is_include_usb_dmg_exe_enabled() {
  load_be_env_keys
  local raw="${INCLUDE_USB_DMG_EXE:-true}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$raw" in
    false|0|no|off) return 1 ;;
    *) return 0 ;;
  esac
}

expand_usb_dmg_exe_path() {
  local dest="${1:-${USB_DMG_EXE:-}}"
  local sf="${STORAGE_FOLDER:-}"
  if [[ -n "$dest" && -n "$sf" ]]; then
    dest="${dest//\$\{STORAGE_FOLDER\}/$sf}"
    dest="${dest//\$STORAGE_FOLDER/$sf}"
  fi
  if [[ -z "$dest" && -n "$sf" ]]; then
    dest="${sf%/}/USB_DMG_EXE"
  fi
  printf '%s' "${dest%/}"
}
