import path from 'path';
import {
  USB_BRIDGE_INSTALLERS,
  contentTypeForInstallerPath,
  getUsbDmgExeDir,
  resolveUsbBridgeInstallerPath,
  usbBridgeInstallerMissingMessage
} from '../../utils/usbBridgeInstallerResolve.js';

/** Public paths the FE uses for Click Here (same-origin download). */
export function getPhotoAlbumsBridgeInstallerUrls() {
  return {
    mac: '/api/photoAlbums/bridge/installer/mac',
    win: '/api/photoAlbums/bridge/installer/win'
  };
}

export { getUsbDmgExeDir };

/**
 * GET /api/photoAlbums/bridge/installer/:platform — mac (.zip) | win (.zip)
 * Auth required. Streams packaged installer from USB_DMG_EXE storage (not git LFS stubs).
 */
export function downloadPhotoAlbumsBridgeInstaller(req, res) {
  const platform = String(req.params.platform || '')
    .trim()
    .toLowerCase();
  const meta = USB_BRIDGE_INSTALLERS[platform];
  if (!meta) {
    return res.status(400).json({ error: 'Use platform mac or win' });
  }

  const filePath = resolveUsbBridgeInstallerPath(platform, {
    macPathEnv: 'PHOTO_ALBUMS_BRIDGE_INSTALLER_MAC_PATH',
    winPathEnv: 'PHOTO_ALBUMS_BRIDGE_INSTALLER_WIN_PATH'
  });
  if (!filePath) {
    return res.status(404).json({ error: usbBridgeInstallerMissingMessage(platform) });
  }

  const sendName = path.basename(filePath);
  res.setHeader('Content-Type', contentTypeForInstallerPath(filePath, meta.contentType));
  res.setHeader('Content-Disposition', `attachment; filename="${sendName}"`);
  return res.sendFile(path.resolve(filePath));
}
