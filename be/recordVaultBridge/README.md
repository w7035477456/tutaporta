# Record Vault USB Bridge

Local agent so [onlinemall.website](https://onlinemall.website) can read and write your **USB Record Vault** from the browser.

The website backend cannot see USB drives on your laptop. This bridge listens on `127.0.0.1:49201` and handles vault USB + encrypted file I/O on your machine.

## End users (recommended) — no Node.js install

### Mac

1. Download **usbBridgeV3-mac.zip**
2. Double-click the zip to unzip
3. Open **`1-START-HERE-Read-Me-First.txt`** and follow the steps (prefer Control-click → Open on the app; or use `2-Open-Privacy-Settings.command`)
4. On onlinemall.website → Record Vault / Photo Albums → USB — the strip turns green when the bridge is up

Zip contents for end users: `1-START-HERE-Read-Me-First.txt`, `2-Open-Privacy-Settings.command`, `usbBridgeV3.app`.
(Do not ship `.webloc` — `x-apple.systempreferences:` weblocs fail on many macOS versions with “document not readable”.)

The app starts at login by default. Leave it running while you use USB vault features. Tray → **Show status window** anytime.

### Windows

1. Download **Record Vault USB Bridge Setup.exe**
2. Run the installer (one-click)
3. The bridge starts and a tray icon appears
4. On onlinemall.website → Record Vault → **Connect local USB** → Allow in Chrome

### Build installers (developers)

```bash
cd be/recordVaultBridge/desktop
npm install
npm run dist:mac    # → be/usb/usbBridgeV3.dmg
npm run dist:win    # → be/usb/usbBridgeV3.exe
```

From `be/`:

```bash
npm run record-vault-bridge:dist:mac
npm run record-vault-bridge:dist:win
```

Installers are copied to **`be/usb/`** (Mac: `/Users/a/code/main/be/usb`, Ubuntu: `/home/lawsen0/code/main/be/usb`). `be/recordVaultBridge/desktop/dist/` is removed after copy. Both `be/usb/` and `desktop/dist/` are gitignored.

### Mac code signing + notarization (required for website downloads)

Unsigned DMGs hit Gatekeeper: *“Apple could not verify … is free of malware”* after a browser download.

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) and create a **Developer ID Application** certificate in Keychain (Xcode → Settings → Accounts → Manage Certificates).
2. Confirm the identity exists:

```bash
security find-identity -v -p codesigning
# look for: "Developer ID Application: Your Name (TEAMID)"
```

3. Create an [app-specific password](https://appleid.apple.com) for notarization.
4. Rebuild signed + notarized:

```bash
cd be/recordVaultBridge/desktop
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"   # exact string from step 2
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
npm run dist:mac
```

5. Verify before publishing the DMG:

```bash
codesign -dv --verbose=2 dist/mac/usbBridgeV3.app
spctl --assess --verbose=4 dist/mac/usbBridgeV3.app
```

Without those env vars / certificates, `npm run dist:mac` still builds, but downloads stay blocked by Gatekeeper. Temporary Mac workaround:

```bash
xattr -cr /Applications/usbBridgeV3.app
open /Applications/usbBridgeV3.app
```

### Windows code signing (SmartScreen)

Needs a Windows Authenticode certificate (`.pfx`). On a Mac/CI host with the PFX available:

```bash
cd be/recordVaultBridge/desktop
export CSC_LINK="/absolute/path/to/codesign.pfx"
export CSC_KEY_PASSWORD="pfx-password"
npm run dist:win
```

Without `CSC_LINK`, `npm run dist:win` produces an unsigned `.exe` (installable, but SmartScreen may warn).

## Developers — run from source

Requires Node.js 18+ and `cd be && npm install`.

```bash
npm run record-vault-bridge
```

Or tray UI without packaging:

```bash
npm run record-vault-bridge:desktop
```

## How it works

1. Bridge starts on `http://127.0.0.1:49201`.
2. On **onlinemall.website**, open Record Vault USB **or** Photo Albums USB and click **Connect local USB** (Chrome requires a click before it will allow the site to reach your computer).
3. When Chrome asks, choose **Allow** for local network access.
4. The site routes USB + vault data API calls to the bridge (`/api/recordVault/*` and `/api/photoAlbums/*`).
5. When you pick a security icon, the **server** returns a derived key (requires login).
6. Bridge unlocks the vault folder on your USB locally.

## Environment (optional)

| Variable | Default |
|----------|---------|
| `RECORD_VAULT_BRIDGE_PORT` | `49201` |
| `RECORD_VAULT_BRIDGE_ALLOWED_ORIGINS` | `https://onlinemall.website,http://localhost:3000` |
| `RECORD_VAULT_BRIDGE_INSTALLER_MAC_PATH` | (optional) absolute path to `.dmg` if not in `be/usb/` |
| `RECORD_VAULT_BRIDGE_INSTALLER_WIN_PATH` | (optional) absolute path to `.exe` if not in `be/usb/` |

Website **TutaNotes USB Login** probes `127.0.0.1:49201`. If unreachable it shows a red download strip (`Click Here` → `/api/recordVault/bridge/installer/mac` or `/win`). When reachable it shows a green status strip matching this window.

## Security

- Binds to **127.0.0.1 only**.
- Uses your logged-in `singles_id` via `X-Record-Vault-Singles-Id` header.
- Vault data stays on USB; bridge does not upload note content to the server.
- Packaged builds run in **standalone** mode (no Postgres / JWT / `~/.ssh/be/.env` on the laptop).

## Mac dev without bridge

On `localhost:3000`, the backend runs on your Mac, so USB often works without the bridge. Use the bridge for **production** from your personal computer.
