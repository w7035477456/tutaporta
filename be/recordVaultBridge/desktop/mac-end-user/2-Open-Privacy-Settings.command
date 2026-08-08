#!/bin/bash
# Double-click this file to open System Settings → Privacy & Security.
# (.webloc shortcuts with x-apple.systempreferences: URLs fail on many Macs.)

set +e
open "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension" 2>/dev/null
if [[ $? -eq 0 ]]; then exit 0; fi

open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null
if [[ $? -eq 0 ]]; then exit 0; fi

open "/System/Applications/System Settings.app" 2>/dev/null \
  || open "/System/Applications/System Preferences.app" 2>/dev/null

echo
echo "If Settings did not open Privacy & Security automatically:"
echo "  Apple menu → System Settings → Privacy & Security"
echo "  Then scroll to the bottom and click Open Anyway for usbBridgeV3."
echo
read -r -p "Press Return to close…" _
