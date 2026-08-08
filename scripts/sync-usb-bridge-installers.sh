#!/usr/bin/env bash
# OPTIONAL emergency sync: Mac USB_DMG_EXE → Ubuntu USB_DMG_EXE over SSH.
#
# Preferred path (no manual SCP):
#   Mac:    usball → commit usbzip/*.zip → push
#   Ubuntu: work2 / febeprod → git lfs pull → scripts/publish-usbzip-to-storage.sh
#
# Why this script still exists: if Git LFS pull fails on Ubuntu, push real zips over SSH.
#
# Usage (Mac, after usball):
#   scripts/sync-usb-bridge-installers.sh
#   scripts/sync-usb-bridge-installers.sh lawsen0@192.168.222.202
#
# Env (optional):
#   DEPLOY_SSH_KEY, DEPLOY_SSH_PORT — same as deploy-ssh-mac.sh
#   USB_DMG_EXE / STORAGE_FOLDER — local source (from ~/.ssh/be/.env if unset)
#   REMOTE_USB_DMG_EXE — remote dest (default: \$HOME path expanded on remote via STORAGE)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="${DEPLOY_SSH_KEY:-/Volumes/MSWORD2010/.coredump/corruptedKey_march2024}"
PORT="${DEPLOY_SSH_PORT:-59221}"
HOST="${1:-lawsen0@192.168.222.202}"

load_local_usb_dir() {
  if [[ -n "${USB_DMG_EXE:-}" ]]; then
    echo "${USB_DMG_EXE%/}"
    return
  fi
  local envf="${HOME}/.ssh/be/.env"
  if [[ -f "$envf" ]]; then
    # shellcheck disable=SC1090
    set -a
    # Expand ${STORAGE_FOLDER} etc.
    # shellcheck disable=SC1091
    source "$envf"
    set +a
  fi
  if [[ -n "${USB_DMG_EXE:-}" ]]; then
    echo "${USB_DMG_EXE%/}"
    return
  fi
  if [[ -n "${STORAGE_FOLDER:-}" ]]; then
    echo "${STORAGE_FOLDER%/}/USB_DMG_EXE"
    return
  fi
  echo ""
}

LOCAL_DIR="$(load_local_usb_dir)"
if [[ -z "$LOCAL_DIR" || ! -d "$LOCAL_DIR" ]]; then
  echo "sync-usb-bridge-installers: local USB_DMG_EXE missing." >&2
  echo "  Set USB_DMG_EXE in ~/.ssh/be/.env and run usball first." >&2
  exit 1
fi

FILES=()
for f in usbBridgeV3-mac.zip usbBridgeV3-win.zip; do
  if [[ -f "$LOCAL_DIR/$f" ]]; then
    # Reject Git LFS pointer stubs
    if head -c 40 "$LOCAL_DIR/$f" | grep -q 'git-lfs.github.com'; then
      echo "sync-usb-bridge-installers: refusing LFS pointer: $LOCAL_DIR/$f" >&2
      echo "  Run usball (or git lfs pull) so this is a real zip." >&2
      exit 1
    fi
    if ! head -c 2 "$LOCAL_DIR/$f" | grep -q 'PK'; then
      echo "sync-usb-bridge-installers: not a zip (missing PK magic): $LOCAL_DIR/$f" >&2
      exit 1
    fi
    FILES+=("$LOCAL_DIR/$f")
  fi
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "sync-usb-bridge-installers: no usbBridgeV3-*.zip in $LOCAL_DIR" >&2
  echo "  Run: usball   # builds + copies into USB_DMG_EXE" >&2
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
set -a
# shellcheck disable=SC1091
source "$HOME/.ssh/be/.env" 2>/dev/null || true
set +a
if [[ -n "${USB_DMG_EXE:-}" ]]; then echo "${USB_DMG_EXE%/}"; exit 0; fi
if [[ -n "${STORAGE_FOLDER:-}" ]]; then echo "${STORAGE_FOLDER%/}/USB_DMG_EXE"; exit 0; fi
echo "$HOME/onlinemallwebsite_storage/USB_DMG_EXE"
EOS
)"
fi

echo "Local : $LOCAL_DIR"
echo "Remote: $HOST:$REMOTE_DIR"
echo "Files : ${FILES[*]}"

"${ssh_cmd[@]}" "$HOST" "mkdir -p $(printf '%q' "$REMOTE_DIR")"

# Prefer rsync over SSH if available; else scp
if command -v rsync >/dev/null 2>&1; then
  rsync -avP -e "ssh -o IdentitiesOnly=yes -i $(printf '%q' "$KEY") -p $PORT" \
    "${FILES[@]}" "$HOST:$REMOTE_DIR/"
else
  scp -o IdentitiesOnly=yes -i "$KEY" -P "$PORT" "${FILES[@]}" "$HOST:$REMOTE_DIR/"
fi

"${ssh_cmd[@]}" "$HOST" "ls -lah $(printf '%q' "$REMOTE_DIR")/usbBridgeV3-*.zip 2>/dev/null; file $(printf '%q' "$REMOTE_DIR")/usbBridgeV3-mac.zip 2>/dev/null || true"
echo "sync-usb-bridge-installers: OK"
