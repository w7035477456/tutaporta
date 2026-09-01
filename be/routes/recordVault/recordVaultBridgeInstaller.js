import path from 'path';
import {
  USB_BRIDGE_INSTALLERS,
  contentTypeForInstallerPath,
  getUsbDmgExeDir,
  resolveUsbBridgeInstallerPath,
  usbBridgeInstallerMissingMessage
} from '../../utils/usbBridgeInstallerResolve.js';
import { isIncludeUsbDmgExeEnabled } from '../../utils/includeUsbDmgExeConfig.js';

/** Public paths the FE uses for Click Here (same-origin download). */
export function getRecordVaultBridgeInstallerUrls() {
  if (!isIncludeUsbDmgExeEnabled()) {
    return { mac: null, win: null };
  }
  return {
    mac: '/api/recordVault/bridge/installer/mac',
    win: '/api/recordVault/bridge/installer/win'
  };
}

export { getUsbDmgExeDir };

/**
 * GET /api/recordVault/bridge/installer/:platform — mac (.zip) | win (.zip)
 * Auth required. Streams packaged installer from USB_DMG_EXE storage (not git LFS stubs).
 */
export function downloadRecordVaultBridgeInstaller(req, res) {
  if (!isIncludeUsbDmgExeEnabled()) {
    return res.status(404).json({ error: usbBridgeInstallerMissingMessage('mac') });
  }
  const platform = String(req.params.platform || '')
    .trim()
    .toLowerCase();
  const meta = USB_BRIDGE_INSTALLERS[platform];
  if (!meta) {
    return res.status(400).json({ error: 'Use platform mac or win' });
  }

  const filePath = resolveUsbBridgeInstallerPath(platform, {
    macPathEnv: 'RECORD_VAULT_BRIDGE_INSTALLER_MAC_PATH',
    winPathEnv: 'RECORD_VAULT_BRIDGE_INSTALLER_WIN_PATH'
  });
  if (!filePath) {
    return res.status(404).json({ error: usbBridgeInstallerMissingMessage(platform) });
  }

  const sendName = path.basename(filePath);
  res.setHeader('Content-Type', contentTypeForInstallerPath(filePath, meta.contentType));
  res.setHeader('Content-Disposition', `attachment; filename="${sendName}"`);
  return res.sendFile(path.resolve(filePath));
}
