# usbzip/

Checked-in USB Bridge installers for deploy.

| Path | Role |
|------|------|
| `usbzip/usbBridgeV3-mac.zip` (this folder) | Built on **Mac** (`usball`), committed (Git LFS). |
| `$USB_DMG_EXE` = `$STORAGE_FOLDER/USB_DMG_EXE` | **Customer download** target. Ubuntu `work2` copies here. |

## Mac

```bash
usball                                          # electron build → USB_DMG_EXE + usbzip/
git add usbzip/usbBridgeV3-*.zip && git commit   # push so Ubuntu can pull
# optional local refresh without rebuild:
scripts/publish-usbzip-to-storage.sh
```

`beall` / `feall` / `work1` call `publish-usbzip-to-storage.sh` (copy only; no Electron rebuild).

## Ubuntu (`work2` / `febeprod`)

```bash
git lfs pull --include="usbzip/**"   # real bytes, not 134-byte LFS pointer
scripts/publish-usbzip-to-storage.sh # → /mnt/pgdata16/.../USB_DMG_EXE/
```

API serves only real ZIP files (`PK` magic); Git LFS pointer stubs are rejected.
