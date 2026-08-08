#!/usr/bin/env bash
# Copy repo usbzip/*.zip → $USB_DMG_EXE (STORAGE_FOLDER/USB_DMG_EXE).
#
# Customer downloads are served from USB_DMG_EXE, NOT from the git working tree.
# Git LFS checkouts often leave ~134-byte pointer stubs in usbzip/ — this script
# refuses those and requires real ZIP magic ("PK").
#
# Mac (after usball / when usbzip/ already has real zips):
#   scripts/publish-usbzip-to-storage.sh
#
# Ubuntu (work2 / febeprod):
#   git lfs pull --include="usbzip/**"
#   scripts/publish-usbzip-to-storage.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USBZIP_DIR="${USBZIP_DIR:-$ROOT/usbzip}"

load_usb_dmg_exe_dir() {
  if [[ -n "${USB_DMG_EXE:-}" ]]; then
    # Expand ${STORAGE_FOLDER} if present literally
    local d="$USB_DMG_EXE"
    if [[ -n "${STORAGE_FOLDER:-}" ]]; then
      d="${d//\$\{STORAGE_FOLDER\}/$STORAGE_FOLDER}"
      d="${d//\$STORAGE_FOLDER/$STORAGE_FOLDER}"
    fi
    echo "${d%/}"
    return
  fi
  local envf="${HOME}/.ssh/be/.env"
  if [[ -f "$envf" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$envf"
    set +a
  fi
  if [[ -n "${USB_DMG_EXE:-}" ]]; then
    local d="$USB_DMG_EXE"
    if [[ -n "${STORAGE_FOLDER:-}" ]]; then
      d="${d//\$\{STORAGE_FOLDER\}/$STORAGE_FOLDER}"
      d="${d//\$STORAGE_FOLDER/$STORAGE_FOLDER}"
    fi
    echo "${d%/}"
    return
  fi
  if [[ -n "${STORAGE_FOLDER:-}" ]]; then
    echo "${STORAGE_FOLDER%/}/USB_DMG_EXE"
    return
  fi
  echo ""
}

is_real_zip() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local sz
  sz=$(wc -c <"$f" | tr -d ' ')
  # LFS pointers are tiny; real mac zip is ~100MB+
  if [[ "$sz" -lt 1000000 ]]; then
    if head -c 64 "$f" | grep -q 'git-lfs.github.com'; then
      echo "publish-usbzip-to-storage: Git LFS pointer (not real zip): $f ($sz bytes)" >&2
      echo "  Fix: on this machine run:  git lfs pull --include=\"usbzip/**\"" >&2
      echo "  Or on Mac rebuild:         usball   (writes real zip into usbzip/)" >&2
      return 1
    fi
    echo "publish-usbzip-to-storage: file too small to be installer zip: $f ($sz bytes)" >&2
    return 1
  fi
  if ! head -c 2 "$f" | grep -q 'PK'; then
    echo "publish-usbzip-to-storage: missing ZIP magic PK: $f" >&2
    return 1
  fi
  return 0
}

DEST="$(load_usb_dmg_exe_dir)"
if [[ -z "$DEST" ]]; then
  echo "publish-usbzip-to-storage: USB_DMG_EXE / STORAGE_FOLDER not set (see ~/.ssh/be/.env)" >&2
  exit 1
fi

if [[ ! -d "$USBZIP_DIR" ]]; then
  echo "publish-usbzip-to-storage: missing $USBZIP_DIR" >&2
  exit 1
fi

mkdir -p "$DEST"

copied=0
kept=0
for f in usbBridgeV3-mac.zip usbBridgeV3-win.zip; do
  src="$USBZIP_DIR/$f"
  dest="$DEST/$f"
  if [[ ! -f "$src" ]]; then
    if is_real_zip "$dest" 2>/dev/null; then
      echo "publish-usbzip-to-storage: keep existing $dest (no $src in repo)"
      kept=$((kept + 1))
    else
      echo "publish-usbzip-to-storage: skip (absent): $src"
    fi
    continue
  fi
  if ! is_real_zip "$src"; then
    # LFS pointer / stub: do not wipe a good install already in STORAGE
    if is_real_zip "$dest" 2>/dev/null; then
      echo "publish-usbzip-to-storage: WARN keeping $dest (repo $src is not a real zip — run git lfs pull)" >&2
      kept=$((kept + 1))
      continue
    fi
    exit 1
  fi
  cp -f "$src" "$dest"
  echo "publish-usbzip-to-storage: $src -> $dest ($(ls -lh "$dest" | awk '{print $5}'))"
  copied=$((copied + 1))
done

if [[ "$copied" -eq 0 && "$kept" -eq 0 ]]; then
  echo "publish-usbzip-to-storage: no usbBridgeV3-*.zip in $USBZIP_DIR or $DEST" >&2
  echo "  On Mac: usball  (builds + writes usbzip/ for git commit)" >&2
  exit 1
fi

echo "publish-usbzip-to-storage: OK (copied=$copied kept=$kept in $DEST)"
ls -lh "$DEST"/usbBridgeV3-*.zip 2>/dev/null || true
