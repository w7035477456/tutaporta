#!/usr/bin/env bash
# PRIMARY path: Mac → Ubuntu $USB_DMG_EXE over SSH (no git for installer zips).
#
# Why not git? usbBridgeV3-mac.zip is ~112MB > GitHub's 100MB limit.
# Why not build Mac zip on Ubuntu? electron-builder --mac needs macOS.
#
# Usage (Mac, after usball):
#   scripts/sync-usb-bridge-installers.sh
#   scripts/sync-usb-bridge-installers.sh lawsen0@192.168.222.202
#
# Env (optional):
#   DEPLOY_SSH_KEY, DEPLOY_SSH_PORT — same as deploy-ssh-mac.sh
#   USB_DMG_EXE / STORAGE_FOLDER — local source (from ~/.ssh/be/.env if unset)
#   REMOTE_USB_DMG_EXE — remote dest

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/include-usb-dmg-exe-env.sh
source "$ROOT/scripts/lib/include-usb-dmg-exe-env.sh"

if ! is_include_usb_dmg_exe_enabled; then
  echo "sync-usb-bridge-installers: SKIP (INCLUDE_USB_DMG_EXE=false)"
  exit 0
fi

KEY="${DEPLOY_SSH_KEY:-/Volumes/MSWORD2010/.coredump/corruptedKey_march2024}"
PORT="${DEPLOY_SSH_PORT:-59221}"
HOST="${1:-lawsen0@192.168.222.202}"

load_key_from_env_file() {
  local key="$1"
  local envf="${HOME}/.ssh/be/.env"
  [[ -f "$envf" ]] || return 0
  local line k v
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    [[ "$line" == "${key}="* ]] || continue
    v="${line#*=}"
    v="${v%%#*}"
    v="$(echo "$v" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    printf -v "$key" '%s' "$v"
    export "$key"
    return 0
  done <"$envf"
}

load_local_usb_dir() {
  load_key_from_env_file STORAGE_FOLDER
  load_key_from_env_file USB_DMG_EXE
  local d="${USB_DMG_EXE:-}"
  if [[ -n "$d" && -n "${STORAGE_FOLDER:-}" ]]; then
    d="${d//\$\{STORAGE_FOLDER\}/$STORAGE_FOLDER}"
    d="${d//\$STORAGE_FOLDER/$STORAGE_FOLDER}"
  fi
  if [[ -n "$d" ]]; then
    echo "${d%/}"
    return
  fi
  if [[ -n "${STORAGE_FOLDER:-}" ]]; then
    echo "${STORAGE_FOLDER%/}/USB_DMG_EXE"
    return
  fi
  # Fallback: repo usbzip/ (gitignored local staging)
  if [[ -d "$ROOT/usbzip" ]]; then
    echo "$ROOT/usbzip"
    return
  fi
  echo ""
}

is_real_zip() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local sz
  sz=$(wc -c <"$f" | tr -d ' ')
  [[ "$sz" -ge 1000000 ]] || return 1
  head -c 2 "$f" | grep -q 'PK'
}

LOCAL_DIR="$(load_local_usb_dir)"
if [[ -z "$LOCAL_DIR" || ! -d "$LOCAL_DIR" ]]; then
  echo "sync-usb-bridge-installers: local USB_DMG_EXE / usbzip missing." >&2
  echo "  Run usball first (builds into \$USB_DMG_EXE)." >&2
  exit 1
fi

FILES=()
for f in usbBridgeV3-mac.zip usbBridgeV3-win.zip; do
  # Prefer USB_DMG_EXE, then repo usbzip/
  cand=""
  if is_real_zip "$LOCAL_DIR/$f"; then
    cand="$LOCAL_DIR/$f"
  elif is_real_zip "$ROOT/usbzip/$f"; then
    cand="$ROOT/usbzip/$f"
  fi
  if [[ -n "$cand" ]]; then
    FILES+=("$cand")
  else
    echo "sync-usb-bridge-installers: WARN missing real zip: $f" >&2
  fi
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "sync-usb-bridge-installers: no real usbBridgeV3-*.zip to sync" >&2
  echo "  Run: usball" >&2
  exit 1
fi

if [[ ! -r "$KEY" ]]; then
  echo "sync-usb-bridge-installers: SSH key not readable: $KEY" >&2
  exit 1
fi

ssh_cmd=(ssh -o IdentitiesOnly=yes -o BatchMode=yes -i "$KEY" -p "$PORT")

REMOTE_DIR="${REMOTE_USB_DMG_EXE:-}"
if [[ -z "$REMOTE_DIR" ]]; then
  REMOTE_DIR="$("${ssh_cmd[@]}" "$HOST" 'bash -s' <<'EOS'
set -e
STORAGE_FOLDER=""
USB_DMG_EXE=""
envf="$HOME/.ssh/be/.env"
if [[ -f "$envf" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in
      STORAGE_FOLDER=*|USB_DMG_EXE=*)
        k="${line%%=*}"
        v="${line#*=}"
        v="${v%%#*}"
        v="$(echo "$v" | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" -e "s/^\"//" -e "s/\"$//")"
        printf -v "$k" "%s" "$v"
        ;;
    esac
  done <"$envf"
fi
if [[ -n "${USB_DMG_EXE:-}" ]]; then
  d="$USB_DMG_EXE"
  if [[ -n "${STORAGE_FOLDER:-}" ]]; then
    d="${d//\$\{STORAGE_FOLDER\}/$STORAGE_FOLDER}"
    d="${d//\$STORAGE_FOLDER/$STORAGE_FOLDER}"
  fi
  echo "${d%/}"
  exit 0
fi
if [[ -n "${STORAGE_FOLDER:-}" ]]; then echo "${STORAGE_FOLDER%/}/USB_DMG_EXE"; exit 0; fi
echo "/mnt/pgdata16/onlinemallwebsite_storage/USB_DMG_EXE"
EOS
)"
fi

echo "Local files → $HOST:$REMOTE_DIR"
printf '  %s\n' "${FILES[@]}"

"${ssh_cmd[@]}" "$HOST" "mkdir -p $(printf '%q' "$REMOTE_DIR")"

if command -v rsync >/dev/null 2>&1; then
  rsync -avP -e "ssh -o IdentitiesOnly=yes -o BatchMode=yes -i $(printf '%q' "$KEY") -p $PORT" \
    "${FILES[@]}" "$HOST:$REMOTE_DIR/"
else
  scp -o IdentitiesOnly=yes -o BatchMode=yes -i "$KEY" -P "$PORT" "${FILES[@]}" "$HOST:$REMOTE_DIR/"
fi

"${ssh_cmd[@]}" "$HOST" "ls -lah $(printf '%q' "$REMOTE_DIR")/usbBridgeV3-*.zip 2>/dev/null; file $(printf '%q' "$REMOTE_DIR")/usbBridgeV3-mac.zip 2>/dev/null || true"
echo "sync-usb-bridge-installers: OK — customer downloads use this folder (not git)"
