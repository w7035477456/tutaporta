#!/usr/bin/env bash
# Mac: build USB Bridge electron app only when INCLUDE_USB_DMG_EXE=true.
# Usage: scripts/build-usb-bridge-if-enabled.sh [mac|win|all]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/include-usb-dmg-exe-env.sh
source "$ROOT/scripts/lib/include-usb-dmg-exe-env.sh"

if ! is_include_usb_dmg_exe_enabled; then
  echo "[usb-bridge-build] SKIP — INCLUDE_USB_DMG_EXE=false"
  exit 0
fi

target="${1:-mac}"
desktop="$ROOT/be/recordVaultBridge/desktop"
cd "$desktop"

case "$target" in
  mac) npm run dist:mac ;;
  win) npm run dist:win ;;
  all)
    npm run dist:mac
    npm run dist:win
    ;;
  *)
    echo "Usage: $0 [mac|win|all]" >&2
    exit 1
    ;;
esac

echo "[usb-bridge-build] OK ($target)"
