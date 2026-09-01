#!/usr/bin/env bash
# Copy repo usbzip/*.zip → $USB_DMG_EXE (STORAGE_FOLDER/USB_DMG_EXE).
#
# Customer downloads are served from USB_DMG_EXE, NOT from the git working tree.
# Refuses Git LFS pointer stubs (~134 bytes). Copies every real zip found.
#
# USB Bridge installers are OPTIONAL for FE/BE deploy. Missing zips → WARN + exit 0
# (does not abort febeprod / work2). Force hard fail: REQUIRE_USBZIP=1
#
# Skip entirely:
#   SKIP_USBZIP_PUBLISH=1 scripts/publish-usbzip-to-storage.sh
#
# Mac (after usball):
#   scripts/publish-usbzip-to-storage.sh
#
# Ubuntu (work2 / febeprod):
#   scripts/publish-usbzip-to-storage.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/include-usb-dmg-exe-env.sh
source "$ROOT/scripts/lib/include-usb-dmg-exe-env.sh"

if ! is_include_usb_dmg_exe_enabled; then
  echo "publish-usbzip-to-storage: SKIP (INCLUDE_USB_DMG_EXE=false)"
  exit 0
fi

if [[ "${SKIP_USBZIP_PUBLISH:-}" == "1" || "${SKIP_USBZIP_PUBLISH:-}" == "true" ]]; then
  echo "publish-usbzip-to-storage: SKIP (SKIP_USBZIP_PUBLISH=${SKIP_USBZIP_PUBLISH})"
  exit 0
fi

USBZIP_DIR="${USBZIP_DIR:-$ROOT/usbzip}"

load_usb_dmg_exe_dir() {
  if [[ -n "${USB_DMG_EXE:-}" ]]; then
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
    # Prefer parsing known keys — sourcing .env can break on unquoted values.
    while IFS= read -r line || [[ -n "$line" ]]; do
      case "$line" in
        ''|\#*) continue ;;
      esac
      if [[ "$line" =~ ^(STORAGE_FOLDER|USB_DMG_EXE)= ]]; then
        local k="${line%%=*}"
        local v="${line#*=}"
        v="${v%%#*}"
        v="$(echo "$v" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
        printf -v "$k" '%s' "$v"
        export "$k"
      fi
    done <"$envf"
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

is_lfs_pointer() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local sz
  sz=$(wc -c <"$f" | tr -d ' ')
  [[ "$sz" -lt 1000 ]] || return 1
  head -c 64 "$f" | grep -q 'git-lfs.github.com'
}

is_real_zip() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  local sz
  sz=$(wc -c <"$f" | tr -d ' ')
  if [[ "$sz" -lt 1000000 ]]; then
    return 1
  fi
  head -c 2 "$f" | grep -q 'PK'
}

try_git_lfs_pull() {
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi
  if ! git -C "$ROOT" lfs version >/dev/null 2>&1; then
    echo "publish-usbzip-to-storage: WARN git-lfs not installed on this host." >&2
    echo "  If usbzip/*.zip are LFS pointers, install: sudo apt-get install -y git-lfs && git lfs install" >&2
    return 0
  fi
  echo "publish-usbzip-to-storage: git lfs pull --include=usbzip/**"
  git -C "$ROOT" lfs pull --include="usbzip/**" || git -C "$ROOT" lfs pull || true
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
try_git_lfs_pull

copied=0
kept=0
failed=0
declare -a failed_names=()

for f in usbBridgeV3-mac.zip usbBridgeV3-win.zip; do
  src="$USBZIP_DIR/$f"
  dest="$DEST/$f"

  if [[ ! -f "$src" ]]; then
    if is_real_zip "$dest"; then
      echo "publish-usbzip-to-storage: keep existing $dest (no $src in repo)"
      kept=$((kept + 1))
    else
      echo "publish-usbzip-to-storage: skip (absent): $src"
    fi
    continue
  fi

  if is_lfs_pointer "$src" || ! is_real_zip "$src"; then
    echo "publish-usbzip-to-storage: SKIP (not a real zip): $src ($(wc -c <"$src" | tr -d ' ') bytes)" >&2
    if is_lfs_pointer "$src"; then
      echo "  → Git LFS pointer. Install git-lfs and pull, or stop tracking this file with LFS." >&2
    fi
    # Never leave / overwrite storage with a pointer stub
    if is_lfs_pointer "$dest"; then
      rm -f "$dest"
      echo "publish-usbzip-to-storage: removed LFS stub from $dest" >&2
    fi
    if is_real_zip "$dest"; then
      echo "publish-usbzip-to-storage: keep existing real $dest" >&2
      kept=$((kept + 1))
    else
      failed=$((failed + 1))
      failed_names+=("$f")
    fi
    continue
  fi

  if ! cp -f "$src" "$dest" 2>/dev/null; then
    echo "publish-usbzip-to-storage: WARN copy failed (dest not writable?): $dest" >&2
    if is_real_zip "$dest"; then
      echo "publish-usbzip-to-storage: keep existing real $dest" >&2
      kept=$((kept + 1))
    else
      failed=$((failed + 1))
      failed_names+=("$f")
    fi
    continue
  fi
  # verify dest after copy
  if ! is_real_zip "$dest"; then
    echo "publish-usbzip-to-storage: ERROR copy failed validation: $dest" >&2
    rm -f "$dest" 2>/dev/null || true
    failed=$((failed + 1))
    failed_names+=("$f")
    continue
  fi
  echo "publish-usbzip-to-storage: $src -> $dest ($(ls -lh "$dest" | awk '{print $5}'))"
  copied=$((copied + 1))
done

echo "publish-usbzip-to-storage: summary copied=$copied kept=$kept failed=$failed dest=$DEST"
ls -lh "$DEST"/usbBridgeV3-*.zip 2>/dev/null || echo "publish-usbzip-to-storage: (no usbBridgeV3-*.zip in dest yet)"

require_usbzip=false
if [[ "${REQUIRE_USBZIP:-}" == "1" || "${REQUIRE_USBZIP:-}" == "true" ]]; then
  require_usbzip=true
fi

if [[ "$copied" -eq 0 && "$kept" -eq 0 ]]; then
  echo "publish-usbzip-to-storage: WARN no USB Bridge installer zips (optional — FE/BE deploy OK)." >&2
  echo "  To publish later: Mac usball → scripts/sync-usb-bridge-installers.sh" >&2
  if $require_usbzip; then
    echo "publish-usbzip-to-storage: ERROR REQUIRE_USBZIP=1 and nothing published to $DEST" >&2
    exit 1
  fi
  exit 0
fi

if [[ "$failed" -gt 0 ]]; then
  echo "publish-usbzip-to-storage: WARN incomplete publish: ${failed_names[*]} (optional)." >&2
  echo "  Dest may still be missing some platform zip(s)." >&2
  if $require_usbzip; then
    echo "publish-usbzip-to-storage: ERROR REQUIRE_USBZIP=1 incomplete: ${failed_names[*]}" >&2
    exit 1
  fi
  exit 0
fi

echo "publish-usbzip-to-storage: OK"
