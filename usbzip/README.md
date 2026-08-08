# usbzip/

Do **not** rely on this folder for production downloads.

`usbBridgeV3-mac.zip` is tracked with **Git LFS**. A plain `git pull` on Ubuntu
often leaves a ~134-byte LFS **pointer** text file, which browsers save as a
broken zip.

## Canonical download path (servers)

`$USB_DMG_EXE` from `~/.ssh/be/.env` (usually `$STORAGE_FOLDER/USB_DMG_EXE`):

- Mac: `/Users/…/onlinemallwebsite_storage/USB_DMG_EXE/usbBridgeV3-mac.zip`
- Ubuntu: `/mnt/pgdata16/onlinemallwebsite_storage/USB_DMG_EXE/usbBridgeV3-mac.zip`

## Long-term workflow

1. **Mac build:** `usball` → writes real zips into local `USB_DMG_EXE`
2. **Sync to Ubuntu:** `scripts/sync-usb-bridge-installers.sh` (alias `syncusbbridge`)
3. API serves only files that pass zip/`PK` checks (rejects LFS pointers)
