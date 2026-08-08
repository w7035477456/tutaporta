/** Same-origin API routes — never expose USB_DMG_EXE filesystem paths to the browser. */
export const USB_BRIDGE_INSTALLER_API = {
  mac: '/api/recordVault/bridge/installer/mac',
  win: '/api/recordVault/bridge/installer/win'
};

/**
 * Config must only use API paths. Reject absolute disk paths (e.g. /mnt/.../USB_DMG_EXE/*.zip).
 */
export function normalizeUsbBridgeInstallerUrl(raw, platform = 'mac') {
  const fallback = platform === 'win' ? USB_BRIDGE_INSTALLER_API.win : USB_BRIDGE_INSTALLER_API.mac;
  const url = String(raw ?? '').trim();
  if (!url) return fallback;
  if (url === USB_BRIDGE_INSTALLER_API.mac || url === USB_BRIDGE_INSTALLER_API.win) return url;
  if (url.startsWith('/api/recordVault/bridge/installer/')) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const looksLikeDiskPath =
    url.startsWith('/mnt/') ||
    url.startsWith('/Users/') ||
    url.startsWith('/home/') ||
    url.includes('/USB_DMG_EXE/') ||
    url.includes('USB_DMG_EXE') ||
    /\.(zip|dmg|exe)(\?|$)/i.test(url);

  if (looksLikeDiskPath) return fallback;
  return fallback;
}
