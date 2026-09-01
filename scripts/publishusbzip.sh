#!/usr/bin/env bash
# Ubuntu febeprod step 6 — publish USB Bridge zips when INCLUDE_USB_DMG_EXE=true.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/include-usb-dmg-exe-env.sh
source "$ROOT/scripts/lib/include-usb-dmg-exe-env.sh"

if ! is_include_usb_dmg_exe_enabled; then
  echo "[publishusbzip] SKIP — INCLUDE_USB_DMG_EXE=false (USB Bridge build/publish disabled)"
  exit 0
fi

script="$ROOT/scripts/publish-usbzip-to-storage.sh"
if [[ ! -f "$script" ]]; then
  echo "[publishusbzip] missing $script" >&2
  exit 1
fi
chmod +x "$script" 2>/dev/null || true
bash "$script"
echo "[publishusbzip] OK"
