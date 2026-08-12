# usbzip/

Local staging only — **zips are not checked into git** (GitHub hard limit 100MB;
Git LFS is unreliable here because Ubuntu often has no `git-lfs`).

| Path | Role |
|------|------|
| Mac `$USB_DMG_EXE` | Built by `usball` (local downloads) |
| `usbzip/*.zip` | Local copy next to the repo (gitignored) |
| Ubuntu `$STORAGE_FOLDER/USB_DMG_EXE` | Customer downloads on onlinemall.website |

## Workflow

```bash
# Mac — build (requires macOS for the .app zip; cannot build Mac zip on Ubuntu)
usball

# Mac — push zips to Ubuntu storage over SSH (no git)
scripts/sync-usb-bridge-installers.sh

# Ubuntu — normal deploy (code only; zips already in USB_DMG_EXE)
work2   # or febeprod
```

USB Bridge zips are **optional**. `febeprod` / `publish-usbzip-to-storage.sh` warn and continue when zips are missing (set `REQUIRE_USBZIP=1` to hard-fail). Skip the step with `SKIP_USBZIP_PUBLISH=1`.

`work1` / `usball` call the sync script when possible so you do not SCP by hand.
